var fs          = require("fs");
var yaml        = require("./yaml");
var readline    = require("readline");
var {spawn, spawnSync} = require("child_process");
const SINGLE_FILES_SHA1   = "C18FB5C7A6266BA182A0BEE66E7538A89400D48A";
const SINGLE_FILES_TAR_GZ = "https://tundrafizz.com/temp.tar.gz";
const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const PURPLE = "\x1b[95m";
const RESET  = "\x1b[0m";

/* Commands are an array of objects [
  usage     : STRING,
  parameters: OBJECT,
  options   : OBJECT,
  flags     : OBJECT,
  examples  : ARRAY]    */

var stuff = {
  "initialize": {
    "helpText": "Sets up NGINX, MySQL, and phpMyAdmin",
    "commands": null
  },
  "wizard": {
    "helpText": "Easily deploys a Node.js application",
    "commands": null
  },
  "remove_service": {
    "helpText": "Removes a service",
    "commands": null
  },
  "nuke_everything": {
    "helpText": "Nuke everything",
    "commands": null
  },
  "view_all": {
    "helpText": "View all services, containers, images, and volumes",
    "commands": null
  },
  "ssl" : {
    "helpText": "Generates an SSL certificate",
    "commands": [{
      "usage": "ssl [PARAMETERS] [OPTIONS] [FLAGS]"
    },{
      "parameters": {
        "-d": "Domain for the SSL certificate",
        "-i": "Image name of what you're creating the SSL certificate for",
        "-s": "Stack name that contains the service"
      }},{
      "options": {
        "-p": "Port to use for the domain (default = 80)",
        "-e": "Email to use when generating certs (default = none)"
      }},{
      "flags": {
        "-t": "Testing mode"
      }},{
      "examples": [
        "ssl -d example.com -i example-com -s sample",
        "ssl -d example.com -p 9001 -i example-com -s sample",
        "ssl -d example.com -i example-com -s sample -t",
        "ssl -d example.com -p 9001 -i example-com -s sample -e myself@example.com -t"
      ]
    }]
  },
  "renew_ssl": {
    "helpText": "Renew all SSL certificates",
    "commands": null
  },
  "create_database": {
    "helpText": "??????????",
    "commands": null
  },
  "backup_database": {
    "helpText": "??????????",
    "commands": null
  },
  "restore_database": {
    "helpText": "??????????",
    "commands": null
  },
  "help": {
    "helpText": "Displays this screen",
    "commands": null
  },
  "quit": {
    "helpText": "Quits the program",
    "commands": null
  },
  "y": {
    "helpText": "zzzzzzzzzzzzzzzzzz",
    "commands": null
  },
  "z": {
    "helpText": "zzzzzzzzzzzzzzzzzz",
    "commands": null
  }
};

var rl = readline.createInterface({
  "input": process.stdin,
  "output": process.stdout,
  "completer": completer
});

function completer(line){
  var autoComplete = [];

  for(key in stuff)
    autoComplete.push(key);

  var hits = autoComplete.filter(function(c){
    return c.indexOf(line) == 0;
  });

  return [hits.length ? hits : autoComplete, line]; // Show all if none found
}

function Help(command){
  console.log(`\n========== ${command} ==========`);
  command = stuff[command];

  for(var i = 0; i < command.length; i++){
    var obj = command[i];
    var key = Object.keys(obj)[0];
    var val = obj[key];

    console.log(`[${key.toUpperCase()}]`);
    if(val.constructor === String)                 console.log(val);
    if(val.constructor === Object) for(key in val) console.log(key, val[key]);
    if(val.constructor === Array ) for(key in val) console.log(val[key]);
    console.log();
  }
}

/******************************************* EXTENSIONS *******************************************/
Array.prototype.Display = function(){
  for(var i = 0; i < this.length; i++)
    console.log(this[i]);
}

/**************************************** UTILITY FUNCTIONS ***************************************/
function RunCommand(command, flavorText = null){
  var out = [];
  var err = null;

  if(flavorText) console.log(`${CYAN}${flavorText}${RESET}`);

  var array = command.split(" ");
  var cmd   = array[0];
  var args  = [];

  for(var i = 1; i < array.length; i++)
    args.push(array[i]);

  var s = spawnSync(cmd, args);

  if(s.stdout.length) out = s.stdout.toString("utf-8").trim().split("\n");
  if(s.stderr.length) err = s.stderr.toString("utf-8").trim().split("\n");

  return {
    "out": out,
    "err": err
  };
}

RunCommandAsync = function(command, flavorText = null){return new Promise((done, err) => {
  if(flavorText) console.log(`${CYAN}${flavorText}${RESET}`);

  var array = command.split(" ");
  var cmd   = array[0];
  var args  = [];

  for(var i = 1; i < array.length; i++)
    args.push(array[i]);

  var s = spawn(cmd, args);

  s.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  s.stderr.on("data", (data) => {
    err(data)
    return;
  });

  s.on("close", (code) => {
    done();
    return;
  });
})}

function RunCommandInDockerContainer(container, command){
  var out = [];
  var err = null;

  var s = spawnSync("docker", ["exec", container, "bash", "-c", command]);

  console.log(">>>", command);

  if(s.stdout.length) out = s.stdout.toString("utf-8").trim().split("\n");
  if(s.stderr.length) err = s.stderr.toString("utf-8").trim().split("\n");

  return {
    "out": out,
    "err": err
  };
}

function GetDockerContainerIdFromImageName(name){
  // Get the output of all containers (docker container ls), trim the string (remove spaces/newlines from ends), and split it by newline
  var output = RunCommand("docker container ls")["out"];
  var containers = [];

  // Search through all containers
  for(var i = 0; i < output.length; i++){
    // Remove all duplicate spaces, because otherwise the .split function below won't work
    // Matches a "space" character (match 1 or more of the preceding token)
    var line = output[i].replace(/ +/g, " ");

    // There are seven attributes for each container delimited by spaces:
    // Container ID, Image, Command, Created, Status, Ports, Names
    // I only care about the Container ID and Image, so extract those
    var containerId = line.split(" ")[0];
    var imageName   = line.split(" ")[1];

    // If imageName contains the name I'm looking for, save the containerId
    if(imageName.indexOf(name) > -1) containers.push(containerId);
  }

  // There must be exactly one ID in containers, otherwise it's an error
  if     (containers.length == 0) console.log("Error: Couldn't find container");
  else if(containers.length  > 1) console.log("Error: Ambiguous container");
  else                            return containers[0];

  // Return 0 to signify an error
  return 0;
}

function GetDockerServiceIdFromImageName(name){
  // Get the output of all containers (docker service ls), trim the string (remove spaces/newlines from ends), and split it by newline
  var output = RunCommand("docker service ls")["out"];
  var containers = [];

  // Search through all containers
  for(var i = 0; i < output.length; i++){
    // Remove all duplicate spaces, because otherwise the .split function below won't work
    // Matches a "space" character (match 1 or more of the preceding token)
    var line = output[i].replace(/ +/g, " ");

    // There are six attributes for each service delimited by spaces:
    // Service ID, Name, Mode, Replicas, Image, Ports
    // I only care about the Container ID and Image, so extract those
    var serviceId = line.split(" ")[0];
    var imageName = line.split(" ")[4];

    // If imageName contains the name I'm looking for, save the serviceId
    if(imageName.indexOf(name) > -1) containers.push(serviceId);
  }

  // There must be exactly one ID in containers, otherwise it's an error
  if     (containers.length == 0) console.log("Error: Couldn't find service");
  else if(containers.length  > 1) console.log("Error: Ambiguous service");
  else                            return containers[0];

  // Return 0 to signify an error
  return 0;
}

function GetDockerImageIdFromImageName(name){
  // Get the output of all containers (docker image ls), trim the string (remove spaces/newlines from ends), and split it by newline
  var output = RunCommand("docker image ls")["out"];
  var containers = [];

  // Search through all containers
  for(var i = 0; i < output.length; i++){
    // Remove all duplicate spaces, because otherwise the .split function below won't work
    // Matches a "space" character (match 1 or more of the preceding token)
    var line = output[i].replace(/ +/g, " ");

    // There are five attributes for each image delimited by spaces:
    // Repository, Tag, Image ID, Created, Size
    // I only care about the Image ID and Repository, so extract those
    var imageId    = line.split(" ")[2];
    var repository = line.split(" ")[0];

    // If repository contains the name I'm looking for, save the imageId
    if(repository.indexOf(name) > -1) containers.push(imageId);
  }

  // There must be exactly one ID in containers, otherwise it's an error
  if     (containers.length == 0) console.log("Error: Couldn't find image");
  else if(containers.length  > 1) console.log("Error: Ambiguous image");
  else                            return containers[0];

  // Return 0 to signify an error
  return 0;
}

function CreateBaseDockerCompose(){
  console.log("Creating base Docker compose file");

  var dockerCompose = {
    "version": "3.6",
    "services": {
      "nginx": {
        "image": "nginx",
        "ports": [
          {
            "published": 80,
            "target"   : 80,
            "mode"     : "host"
          },{
            "published": 443,
            "target"   : 443,
            "mode"     : "host"
          },{
            "published": 9000,
            "target"   : 9000,
            "mode"     : "host"
          }
        ],
        "volumes": [
          "./single_files/dhparam.pem:/dhparam.pem",
          "./single_files/nginx.conf:/etc/nginx/nginx.conf",
          "./nginx_conf.d:/etc/nginx/conf.d",
          "ssl_challenge:/ssl_challenge",
          "ssl:/ssl"
        ]
      },
      "mysql": {
        "image": "mysql-custom",
        "volumes": [
          "./single_files/mysql.cnf:/mysql.cnf",
          "sql_storage:/var/lib/mysql"
        ],
        "environment": {
          "MYSQL_ROOT_PASSWORD": "fizz"
        },
        "entrypoint": ["/entrypoint.sh", "--default-authentication-plugin=mysql_native_password"]
      },
      "phpmyadmin": {
        "image": "phpmyadmin/phpmyadmin", // Can I get away with just phpmyadmin?
        "volumes": [
          "./single_files/config.inc.php:/etc/phpmyadmin/config.inc.php",
          "./single_files/header.twig:/www/templates/login/header.twig",
          "./single_files/index.php:/www/index.php"
        ],
        "environment": {
          "PMA_HOST": "mysql",
          "PMA_PORT": "3306"
        },
        "depends_on": ["mysql"]
      }
    },
    "volumes": {
      "sql_storage"  : null,
      "ssl_challenge": null,
      "ssl"          : null
    }
  };

  fs.writeFileSync("docker-compose.yml", yaml.safeDump(dockerCompose), "utf-8");
  console.log("Complete!");
}

/**************************************** HELPER FUNCTIONS ****************************************/
Initialize = function(dockerStackName){return new Promise((done, err) => {
  RunCommand("mkdir mysql-custom-image", "Creating directory mysql-custom-image");

  // Create a temporary Dockerfile for a custom MySQL image that will update itself and install the following:
  // - nano
  // - python-pip
  // - awscli
  var customMySqlDockerfile = "FROM mysql\n";
  customMySqlDockerfile += "RUN apt-get update && apt-get install -y nano && apt-get install -y python-pip && pip install -q awscli\n";
  fs.writeFileSync("mysql-custom-image/Dockerfile", customMySqlDockerfile, "utf-8");

  // NOTE: I might as well build the NGINX and phpMyAdmin images here as well!
  RunCommandAsync            ("docker pull nginx"                , "Pulling NGINX")
  .then(() => RunCommandAsync("docker pull mysql"                , "Pulling MySQL"))
  .then(() => RunCommandAsync("docker pull phpmyadmin/phpmyadmin", "Pulling phpMyAdmin"))
  .then(() => RunCommandAsync("docker pull node:carbon"          , "Pulling Node:Carbon"))
  .then(() => RunCommandAsync("docker build -t mysql-custom mysql-custom-image", "Building the custom MySQL image"))
  .then(() => {
    RunCommand("rm -rf mysql-custom-image", "Removing directory mysql-custom-image");

    if(!fs.existsSync("docker-compose.yml")) CreateBaseDockerCompose();
    if(!fs.existsSync("logs"))               fs.mkdirSync("logs");
    if(!fs.existsSync("nginx_conf.d"))       fs.mkdirSync("nginx_conf.d");
    if(!fs.existsSync("single_files"))       fs.mkdirSync("single_files");

    // Get all files in single_files

    var createTar = RunCommand("tar -cf temp.tar single_files", "Creating temporary archive of single_files");
    if(createTar["err"]) err(createTar["err"]);

    var getSha1 = RunCommand("sha1sum temp.tar", "Getting SHA1 of the temporary archive");
    if(getSha1["err"]) err(getSha1["err"]);

    var removeTar = RunCommand("rm temp.tar", "Removing temporary archive of single_files");
    if(removeTar["err"]) err(removeTar["err"]);

    // Extract the SHA1 hash
    var checksum = getSha1["out"][0];

    if(checksum == SINGLE_FILES_SHA1){
      console.log("SHA1 validated");
    }else{
      console.log("SHA1 failed validation");
      RunCommand("rm -rf single_files", "Removing directory single_files");
      RunCommand(`wget -O temp.tar.gz ${SINGLE_FILES_TAR_GZ}`, "Downloading .tar.gz of single_files");
      RunCommand("tar -xzf temp.tar.gz", "Extracting .tar.gz of single_files");
      RunCommand("rm temp.tar.gz", "Removing .tar.gz of single_files");
    }

    done();
  })
  .catch((err) => {
    err(err);
  });
})}

Nconf = function(serviceName, urlDomain, port){return new Promise((done, err) => {
  console.log(`Creating basic NGINX config file: ${serviceName}`);

  var fileName = `nginx_conf.d/${serviceName}.conf`;
  var serverName;

  if(urlDomain == null){
    urlDomain = RunCommand("curl https://api.ipify.org")["out"];
    serverName = urlDomain;
  }else{
    serverName = `${urlDomain} www.${urlDomain}`;
  }

  var lines = [
    `upstream ${serviceName} {`                            ,
    `  server ${serviceName};`                             ,
    `}`                                                    ,
    ``                                                     ,
    `server {`                                             ,
    `  listen ${port};`                                    ,
    `  server_name ${serverName};`                         ,
    ``                                                     ,
    `  location / {`                                       ,
    `    proxy_pass http://${serviceName};`                ,
    `  }`                                                  ,
    ``                                                     ,
    `  location /.well-known/acme-challenge/ {`            ,
    `    alias /ssl_challenge/.well-known/acme-challenge/;`,
    `  }`                                                  ,
    `}`
  ];

  if(fs.existsSync(fileName))
    fs.unlinkSync(fileName);

  for(var i = 0; i < lines.length; i++)
    fs.appendFileSync(fileName, lines[i] + "\n");

  done();
})}

DeployDockerStack = function(dockerStack){return new Promise((done, err) => {
  // TODO: Remove ALL containers first!
  // This makes sure that all containers have the latest version
  // The service will automatically spin up new containers to replace the removed ones

  var res = RunCommand(`docker stack deploy -c docker-compose.yml ${dockerStack}`, `Deploying to stack: ${dockerStack}`);

  if(res["out"]) res["out"].Display();
  if(res["err"]) err(res["err"]);

  done();
})}

ConfigureMySqlContainer = function(dbUsername, dbPassword){return new Promise((done, err) => {
  var attempts = 1;
  var mysqlContainerId = null;

  console.log("Getting MySQL container...");

  // Try 60 times (once per second)
  while(attempts < 60 && !mysqlContainerId){
    var result = GetDockerContainerIdFromImageName("mysql");

    // If a valid result was returned, set it to mysqlContainerId
    if(result != 0){
      mysqlContainerId = result;
      break;
    }

    RunCommand("sleep 1");
  }

  // The MySQL container wasn't found
  if(!mysqlContainerId){
    console.log("Couldn't find MySQL container");
    return;
  }else
    console.log("...found!");

  var mySqlConfig = "/etc/mysql/conf.d/mysql.cnf";
  var host        = "localhost";                       // NOT CURRENTLY USED!
  var user        = "root";                            // NOT CURRENTLY USED!
  var password    = "fizz";                            // NOT CURRENTLY USED!
  var commands    = [
    // `echo '[mysql]'               > ${mySqlConfig}`, // Create config file
    // `echo 'host=${host}'         >> ${mySqlConfig}`, // Append to the config file
    // `echo 'user=${user}'         >> ${mySqlConfig}`,
    // `echo 'password=${password}' >> ${mySqlConfig}`,
    // `echo ''                     >> ${mySqlConfig}`,
    // `echo '[mysqldump]'          >> ${mySqlConfig}`,
    // `echo 'user=${user}'         >> ${mySqlConfig}`,
    // `echo 'password=${password}' >> ${mySqlConfig}`
  ];

  // --no-install-recommends apt-utils

  for(var i = 0; i < commands.length; i++)
    RunCommandInDockerContainer(mysqlContainerId, commands[i]);
})}

CloneRepository = function(repoUrl){return new Promise((done, err) => {
  var res = RunCommand(`git clone ${repoUrl}`, `Cloning repository: ${repoUrl}`);

  if(res["out"]) res["out"].Display();
  if(res["err"]) err(res["err"]);

  done();
})}

ConfigureSettings = function(repoName){return new Promise((done, err) => {
  var configPath = `${repoName}/config.yml`;

  // Skip this if there's no config.yml file
  if(!fs.existsSync(configPath)){
    done();
    return;
  }

  console.log("Configuring settings:", repoName);
  spawnSync("nano", [configPath], {"stdio": "inherit", "detached": true});
  done();
})}

BuildDockerImage = function(serviceName, repoName){return new Promise((done, err) => {
  RunCommandAsync(`docker build -t ${serviceName} ${repoName}`, `Building Docker image "${repoName}" into service "${serviceName}"`)
  .then(() => {
    done();
  });
})}

AddServiceToDockerCompose = function(serviceName){return new Promise((done, err) => {
  console.log("Adding service to Docker compose");

  var doc = yaml.safeLoad(fs.readFileSync("docker-compose.yml", "utf-8"));

  // Create a new object for the services key
  var newService = {
    "image": serviceName,
    "volumes": ["./logs:/usr/src/app/log"],
    "depends_on": ["mysql"]
  };

  doc["services"][serviceName] = newService;
  fs.writeFileSync("docker-compose.yml", yaml.safeDump(doc), "utf-8");
  done();
})}

GenerateNginxConfForSSL = function(serviceName, urlDomain){return new Promise((done, err) => {
  var lines = [
    `upstream ${serviceName} {`                                                                                          ,
    `  server ${serviceName};`                                                                                           ,
    `}`                                                                                                                  ,
    ``                                                                                                                   ,
    `server {`                                                                                                           ,
    `  listen 80;`                                                                                                       ,
    `  server_name ${urlDomain} www.${urlDomain};`                                                                       ,
    ``                                                                                                                   ,
    `  location / {`                                                                                                     ,
    `    return 301 https://${urlDomain}$request_uri;`                                                                   ,
    `  }`                                                                                                                ,
    ``                                                                                                                   ,
    `  location /.well-known/acme-challenge/ {`                                                                          ,
    `    alias /ssl_challenge/.well-known/acme-challenge/;`                                                              ,
    `  }`                                                                                                                ,
    `}`                                                                                                                  ,
    ``                                                                                                                   ,
    `server {`                                                                                                           ,
    `  listen 443 ssl;`                                                                                                  ,
    `  server_name ${urlDomain} www.${urlDomain};`                                                                       ,
    `  ssl_certificate     /ssl/live/${urlDomain}/fullchain.pem;`                                                        ,
    `  ssl_certificate_key /ssl/live/${urlDomain}/privkey.pem;`                                                          ,
    ``                                                                                                                   ,
    `  ssl_protocols TLSv1 TLSv1.1 TLSv1.2;`                                                                             ,
    `  ssl_prefer_server_ciphers on;`                                                                                    ,
    `  ssl_ciphers "ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:RSA+AESGCM:RSA+AES:!aNULL:!MD5:!DSS";`,
    `  ssl_ecdh_curve secp384r1;`                                                                                        ,
    `  ssl_session_cache shared:SSL:10m;`                                                                                ,
    `  ssl_session_tickets off;`                                                                                         ,
    `  ssl_stapling on;`                                                                                                 ,
    `  ssl_stapling_verify on;`                                                                                          ,
    `  resolver 8.8.8.8 8.8.4.4 valid=300s;`                                                                             ,
    `  resolver_timeout 5s;`                                                                                             ,
    `  add_header Strict-Transport-Security "max-age=63072000; includeSubdomains";`                                      ,
    `  add_header X-Frame-Options DENY;`                                                                                 ,
    `  add_header X-Content-Type-Options nosniff;`                                                                       ,
    ``                                                                                                                   ,
    `  ssl_dhparam /dhparam.pem;`                                                                                        ,
    ``                                                                                                                   ,
    `  location / {proxy_pass http://${serviceName};}`                                                                  ,
    `}`
  ];

  var fileName = `nginx_conf.d/${serviceName}.conf`;

  if(fs.existsSync(fileName))
    fs.unlinkSync(fileName);

  for(var i = 0; i < lines.length; i++)
    fs.appendFileSync(fileName, lines[i] + "\n");

  done();
})}

CreateDatabase = function(repoName){return new Promise((done, err) => {
  // A file named "database.sql" should be put into the repository so it can be found here
  // Improve this later
  var dbName       = "coss";
  var fileName     = "coss.sql";
  var databasePath = `${repoName}/database.sql`;

  // Skip this if there's no database.sql file
  if(!fs.existsSync(databasePath)){
    done();
    return;
  }

  var attempts = 1;
  var mysqlContainerId = null;

  console.log("Getting MySQL container...");

  // Try 60 times (once per second)
  while(attempts < 60 && !mysqlContainerId){
    var result = GetDockerContainerIdFromImageName("mysql");

    // If a valid result was returned, set it to mysqlContainerId
    if(result != 0){
      mysqlContainerId = result;
      break;
    }

    RunCommand("sleep 1");
  }

  // The MySQL container wasn't found
  if(!mysqlContainerId){
    console.log("Couldn't find MySQL container");
    return;
  }else
    console.log("...found!");

  // Copy the .sql file into the container
  RunCommand(`docker cp ${databasePath} ${mysqlContainerId}:/${fileName}`);

  var commands = [
    `mysql --defaults-file=/mysql.cnf -e 'create database ${dbName}'`, // Create the database
    `mysql --defaults-file=/mysql.cnf ${dbName} < ${fileName}`,        // Import data from the .sql file into the database
    `rm /${fileName}`                                                  // Remove the .sql file from the container
  ];

  for(var i = 0; i < commands.length; i++)
    RunCommandInDockerContainer(mysqlContainerId, commands[i]);

  done();
})}

UpdateNginx = function(){return new Promise((done, err) => {
  RunCommand(`docker service update dolphin_nginx`, `Updating NGINX`);
  done();
})}

function VerifyIntegrity(){
  // This is important because whenever you're deploying a new application,
  // you must make sure that all the base containers are successfully running.
  // This includes NGINX, MySQL, and phpMyAdmin
  var nginx      = false;
  var mysql      = false;
  var phpmyadmin = false;
  var output     = RunCommand("docker service ls")["out"];

  for(var i = 0; i < output.length; i++){
    // Remove all duplicate spaces, because otherwise the .split function below won't work
    // Matches a "space" character (match 1 or more of the preceding token)
    var line = output[i].replace(/ +/g, " ");

    // There are six attributes for each service delimited by spaces:
    // Service ID, Name, Mode, Replicas, Image, Ports
    // I only care about the Name and Replicas, so extract those
    var serviceName     = line.split(" ")[1];
    var serviceReplicas = line.split(" ")[3];

    // Extract the first value from serviceReplicas: 1/1
    serviceReplicas = serviceReplicas.split("/")[0];

    if(serviceName.indexOf("nginx")      > -1) nginx      = true;
    if(serviceName.indexOf("mysql")      > -1) mysql      = true;
    if(serviceName.indexOf("phpmyadmin") > -1) phpmyadmin = true;

    if(serviceName.indexOf("nginx")      > -1 ||
       serviceName.indexOf("mysql")      > -1 ||
       serviceName.indexOf("phpmyadmin") > -1){

      if(serviceReplicas.indexOf("0") > -1)
       return false;
    }
  }

  if(!nginx || !mysql || !phpmyadmin)
    return false;

  return true;
}

/***************************************** MAIN FUNCTIONS *****************************************/
y = function(args){return new Promise((done) => {
  RunCommandAsync("docker pull mysql", "Building ONLY the base MySQL image")
  .then(() => {
    done();
  });
})}

z = function(args){return new Promise((done) => {
  RunCommand("mkdir mysql-custom-image", "Creating directory mysql-custom-image");

  // Create a temporary Dockerfile for a custom MySQL image that will update itself and install the following:
  // - nano
  // - python-pip
  // - awscli
  var customMySqlDockerfile = "FROM mysql\n";
  customMySqlDockerfile += "RUN apt-get update && apt-get install -y nano && apt-get install -y python-pip && pip install -q awscli\n";
  fs.writeFileSync("mysql-custom-image/Dockerfile", customMySqlDockerfile, "utf-8");

  RunCommandAsync("docker build -t mysql-custom mysql-custom-image", "Building the custom MySQL image")
  .then(() => {
    done();
  });
  // RunCommand("rm -rf mysql-custom-image", "Removing directory mysql-custom-image");

  // CloneRepository(repoUrl)
  // .then(() => {
  //   console.log(`${GREEN}=================== COMPLETED ====================${RESET}`);
  //   done();
  // })
  // .catch((err) => {
  //   console.log(`${RED}===================== ERROR ======================${RESET}`);
  //   console.log(err);
  //   done();
  // });
})}

initialize = function(args){return new Promise((done) => {
  var dockerStackName = "dolphin";

  if(VerifyIntegrity()){
    console.log("Dolphin is already initialized");
    done();
  }else{
    Initialize(dockerStackName)
    .then(() => Nconf("phpmyadmin", null, "9000"))
    .then(() => DeployDockerStack(dockerStackName))
    .then(() => {
      console.log(`${GREEN}=================== COMPLETED ====================${RESET}`);
      done();
    })
    .catch((err) => {
      console.log(`${RED}===================== ERROR ======================${RESET}`);
      console.log(err);
      done();
    });
  }
})}

wizard = function(args){return new Promise((done) => {
  // wizard -r https://github.com/TundraFizz/Docker-Sample-App -u mudki.ps
  // wizard -r https://github.com/TundraFizz/Coss-Stats -u coss-stats.io
  // wizard -r git@github.com:TundraFizz/Coss-Stats.git -u coss-stats.io

  if(!VerifyIntegrity()){
    console.log("Dolphin isn't initialized, run this command first: initialize");
    console.log("Also check the status on NGINX, MySQL, and phpMyAdmin");
    done();
    return;
  }

  if(!fs.existsSync("docker-compose.yml")){
    console.log("No docker-compose.yml file found, aborting");
    done();return;
  }

  var dockerStackName = "dolphin";
  var repoUrl     = (typeof(args["-r"]) === "string" ? args["-r"] : null);
  var urlDomain   = (typeof(args["-u"]) === "string" ? args["-u"] : null);
  var repoName    = "";
  var serviceName = "";

  if(!repoUrl || !urlDomain){
    if(!repoUrl)   console.log("Missing argument: -r");
    if(!urlDomain) console.log("Missing argument: -u");
    done();return;
  }

  // Remove all trailing forward slashes from the URL
  while(repoUrl[repoUrl.length-1] == "/")
    repoUrl = repoUrl.substring(0, repoUrl.length-1);

  // Remove the .git at the end if it's a GIT link
  // HTTPS: https://github.com/TundraFizz/Coss-Stats
  // GIT  : git@github.com:TundraFizz/Coss-Stats.git
  if(repoUrl.substring(repoUrl.length-4, repoUrl.length) == ".git")
    repoUrl = repoUrl.substring(0, repoUrl.length-4);

  // Extract the repository's name from the URL
  repoName = repoUrl.split("/").pop();

  // Set the service's name to the lowercase version of the repository's name
  serviceName = repoName.toLowerCase();

  console.log("==================================================");
  console.log(`dockerStackName | ${dockerStackName}`); // dolphin
  console.log(`repoUrl         | ${repoUrl}`);         // git@github.com:TundraFizz/Coss-Stats.git
  console.log(`repoName        | ${repoName}`);        // Coss-Stats
  console.log(`serviceName     | ${serviceName}`);     // coss-stats
  console.log(`urlDomain       | ${urlDomain}`);       // coss-stats.io
  console.log("==================================================");

  CloneRepository(repoUrl)
  .then(() => ConfigureSettings(repoName))
  .then(() => CreateDatabase(repoName))
  .then(() => BuildDockerImage(serviceName, repoName))
  .then(() => AddServiceToDockerCompose(serviceName))
  .then(() => Nconf(serviceName, urlDomain, "80"))
  // docker stack deploy -c docker-compose.yml dolphin
  // docker service update dolphin_nginx
  // .then(() => DeployDockerStack(dockerStackName)) // See if there's a better way to do this
  // .then(() => UpdateNginx())
  .then(() => {
    console.log(`${GREEN}=================== COMPLETED ====================${RESET}`);
    done();
  })
  .catch((err) => {
    console.log(`${RED}===================== ERROR ======================${RESET}`);
    console.log(err);
    done();
  });
})}

remove_service = function(args){return new Promise((done) => {
  if(!("-r" in args)){
    console.log("Repository name isn't given");
    done();return;
  }

  var repoName    = args["-r"];
  var serviceName = repoName.toLowerCase();
  var serviceId   = GetDockerServiceIdFromImageName(serviceName);
  var imageId     = GetDockerImageIdFromImageName  (serviceName);

  console.log("==================================================");
  console.log(`repoName    | ${repoName}`);
  console.log(`serviceName | ${serviceName}`);
  console.log(`serviceId   | ${serviceId}`);
  console.log(`imageId     | ${imageId}`);
  console.log("==================================================");
  console.log();

  RunCommand(`docker service rm ${serviceId}`);
  RunCommand(`docker image rm ${imageId}`);
  RunCommand(`rm -rf ${repoName}`);
  RunCommand(`rm nginx_conf.d/${serviceName}.conf`);
  // Edit the file docker-compose.yml

  done();
})}

nuke_everything = function(args){return new Promise((done) => {
  // Kill all Docker services
  // Delete all Docker images
  // Delete the following:
  //   - FILE: docker-compose.yml
  //   - DIR : logs
  //   - DIR : nginx_conf.d
  //   - DIR : single_files
  // Every directory that's a repository

  // Run the commands to get the lists of Docker services and images
  var listOfServices = RunCommand("docker service ls -q")["out"];
  var listOfImages   = RunCommand("docker images -q")["out"];

  if(listOfServices.length)
    for(var i = 0; i < listOfServices.length; i++)
      if(listOfServices[i])
        RunCommand(`docker service rm ${listOfServices[i]}`,`Killed Service: ${listOfServices[i]}`);

  if(listOfImages.length){
    // Some images rely on others, so continuously repeat this loop until all images have been removed
    while(true){
      // Get the current images and break out of the while loop if there's no more
      listOfImages = RunCommand("docker images -q")["out"];
      if(listOfImages.length == 0)
        break;

      for(var i = 0; i < listOfImages.length; i++)
        if(listOfImages[i])
          RunCommand(`docker rmi -f ${listOfImages[i]}`, `Deleted Image: ${listOfImages[i]}`);
    }
  }

  RunCommand("docker system prune -f", "Systems Pruned");
  RunCommand("docker volume prune -f", "Volumes Pruned");

  if(fs.existsSync("docker-compose.yml")) RunCommand("rm docker-compose.yml", "Deleted File:   docker-compose.yml");
  if(fs.existsSync("logs"))               RunCommand("rm -rf logs",           "Deleted Dir:    logs");
  if(fs.existsSync("nginx_conf.d"))       RunCommand("rm -rf nginx_conf.d",   "Deleted Dir:    nginx_conf.d");
  if(fs.existsSync("single_files"))       RunCommand("rm -rf single_files",   "Deleted Dir:    single_files");

  // Get all directories that exist in the current working directory,
  // and delete all directories that are considered repositories (contain a Dockerfile)
  // I wonder if I can use "ls" instead of "sh"?
  var listOfDirectories = spawnSync("sh", ["-c", "ls -d */"]);
  listOfDirectories = listOfDirectories.stdout.toString("utf-8").trim().split("\n");

  for(var i = 0; i < listOfDirectories.length; i++){
    var fileList = RunCommand(`ls ${listOfDirectories[i]}`);
    fileList = fileList["out"];

    if(fileList.indexOf("Dockerfile") > -1)
      RunCommand(`rm -rf ${listOfDirectories[i]}`, `Deleted Dir:    ${listOfDirectories[i]}`);
  }

  console.log(`${GREEN}=================== COMPLETED ====================${RESET}`);
  done();
})}

view_all = function(args){return new Promise((done) => {
  var s;

  RunCommand("clear");

  s = RunCommand("docker stack ls");
  if(s["out"]) s["out"].Display();

  s = RunCommand("docker service ls");
  if(s["out"]) s["out"].Display();

  s = RunCommand("docker container ls");
  if(s["out"]) s["out"].Display();

  s = RunCommand("docker volume ls");
  if(s["out"]) s["out"].Display();

  done();
})}

ssl = function(args){return new Promise((done) => {
  var serviceName = "bek-backend";
  var urlDomain   = "tundrafizz.com";
  var containerId = GetDockerContainerIdFromImageName("nginx");

  // Pick one
  var forceRenew = "--force-renew";
  var forceRenew = "";

  // The NGINX container wasn't found
  if(!containerId){
    console.log("Couldn't find NGINX container; SSL certificate not generated");
    done();
    return;
  }

  console.log("Creating an SSL certificate");

  /* docker run -it --rm --name certbot                      \
     -v dolphin_ssl:/etc/letsencrypt                         \
     -v dolphin_ssl_challenge:/ssl_challenge                 \
     certbot/certbot certonly                                \
     --register-unsafely-without-email --webroot --agree-tos \
     -w /ssl_challenge --staging -d mudki.ps                */

  // var hugeCommand = `docker run -i --rm --name certbot -v dolphin_ssl:/etc/letsencrypt -v dolphin_ssl_challenge:/ssl_challenge certbot/certbot certonly --register-unsafely-without-email --webroot --agree-tos -w /ssl_challenge -d ${urlDomain} ${forceRenew}`;
  var hugeCommand = `docker run -i --rm --name certbot -v dolphin_ssl:/etc/letsencrypt -v dolphin_ssl_challenge:/ssl_challenge certbot/certbot certonly --register-unsafely-without-email --webroot --agree-tos -w /ssl_challenge -d ${urlDomain}`;
  var s = RunCommand(hugeCommand);

  console.log("=== OUT ===================================================");
  if(s["out"]) console.log(s["out"]);
  console.log("=== ERR ===================================================");
  if(s["err"]) console.log(s["err"]);
  console.log("===========================================================");

  // Generate a new Nginx config file for the service
  GenerateNginxConfForSSL(serviceName, urlDomain);

  // Restart the NGINX container
  RunCommand(`docker container restart ${containerId}`);

  // I DON'T THINK THIS WORKS, ONLY RESTARTING THE CONTAINER DOES!
  // Reload the Nginx config files inside of the Nginx container
  // s = RunCommand(`docker exec -i ${nginxContainerId} nginx -s reload`);

  done();
})}

renew_ssl = function(args){return new Promise((done) => {
  // TODO
  done();
})}

create_database = function(args){return new Promise((done) => {
  var containerId = GetDockerContainerIdFromImageName("mysql");

  // Required arguments:
  // fileName   | Name of the file to create the database from
  // dbPassword | Password to the database
  //
  // Optional arguments:
  // dbName     | Name of the database that will be created [fileName minus extension]
  // dbUsername | Username to the database [root]

  var fileName   = "coss.sql";
  var dbName     = "coss";
  var dbUsername = "root";
  var dbPassword = "fizz";

  // Copy the .sql file into the container
  RunCommand(`docker cp ${fileName} ${containerId}:/${fileName}`);

  var commands = [
    `mysql --defaults-file=/mysql.cnf -e 'create database ${dbName}'`, // Create the database
    `mysql --defaults-file=/mysql.cnf ${dbName} < ${fileName}`,        // Import data from the .sql file into the database
    `rm /${fileName}`                                                  // Remove the .sql file from the container
  ];

  for(var i = 0; i < commands.length; i++)
    RunCommandInDockerContainer(containerId, commands[i]);

  done();
})}

backup_database = function(args){return new Promise((done) => {
  var date  = new Date();
  var year  = date.getFullYear(); // 4-digit year
  var month = date.getMonth()+1;  // [0-11]
  var day   = date.getDate();     // [1-31]
  var hours = date.getHours();    // [0-23]
  var mins  = date.getMinutes();  // [0-59]
  var secs  = date.getSeconds();  // [0-59]

  if(month < 10) month = "0" + month;
  if(day   < 10) day   = "0" + day;
  if(hours < 10) hours = "0" + hours;
  if(mins  < 10) mins  = "0" + mins;
  if(secs  < 10) secs  = "0" + secs;

  var dbName      = "coss";               // VARIABLE
  var dbUsername  = "root";               // VARIABLE
  var dbPassword  = "fizz";               // VARIABLE
  var bucketName  = "leif-mysql-backups"; // VARIABLE

  var currentTime = `${year}-${month}-${day}T${hours}-${mins}-${secs}`;
  var fileName    = `mysql-backup-${currentTime}.sql.gz`;

  var containerId = GetDockerContainerIdFromImageName("mysql");

  var commands = [
    `mysqldump --defaults-file=/mysql.cnf ${dbName} | gzip --best > ${fileName}`, // Create a backup on the container with the best compression method
    `aws s3 cp ${fileName} s3://${bucketName}`,                                   // Upload the backup to my AWS S3 bucket
    `rm ${fileName}`                                                              // Remove the backup file on the container
  ];

  for(var i = 0; i < commands.length; i++)
    RunCommandInDockerContainer(containerId, commands[i]);

  done();
})}

restore_database = function(args){return new Promise((done) => {
  var dbName      = "coss";
  var dbUsername  = "root";
  var dbPassword  = "fizz";
  var bucketName  = "leif-mysql-backups";

  var fileName    = null;
  var containerId = GetDockerContainerIdFromImageName("mysql");

  var command = `aws s3 ls leif-mysql-backups`;
  var s       = RunCommandInDockerContainer(containerId, command);

  if(s["out"].length){
    // A list of files will be returned in alphanumeric order. This means that the most
    // recent MySQL backup file will be at the end. Pop the final result
    fileName = s["out"].pop();

    // The result will be something like this:
    // 2018-08-10 21:14:19     4992     mysql-backup-2018-08-10T21-14-17.sql.gz
    // I only need the file name at the end, so split by space and pop the final result
    fileName = fileName.split(" ").pop();
  }

  var commands = [
    `aws s3 cp s3://leif-mysql-backups/${fileName} ${fileName}`,       // Download the backed-up MySQL database archive
    `mysql --defaults-file=/mysql.cnf -e 'create database ${dbName}'`, // Create the database
    `zcat ${fileName} | mysql --defaults-file=/mysql.cnf ${dbName}`,   // Load the data in from the file
    `rm ${fileName}`                                                   // Remove the file
  ];

  for(var i = 0; i < commands.length; i++)
    RunCommandInDockerContainer(containerId, commands[i]);

  done();
})}

help = function(){return new Promise((done) => {
  console.log();
  maxLength = 0;
  for(var key in stuff)
    if(maxLength < key.length)
      maxLength = key.length;

  for(var key in stuff){
    var helpText = stuff[key]["helpText"];
    var extraSpaces = maxLength - key.length;
    var line = key;
    for(var i = 0; i < extraSpaces; i++)
      line += " ";
    line += ` ${helpText}`;
    console.log(line);
  }

  console.log();
  done();
})}

quit = function(){return new Promise((done) => {done(true);})}
/**************************************************************************************************/

function ParseCommandAndArgs(input){
  input = input.trim().split(" ");

  var flag    = "";
  var args    = {};
  var command = input[0];

  if(!(command in stuff))
    return {"error": "That command doesn't exist"};

  input.shift();

  for(var i = 0; i < input.length; i++){
    if(input[i][0] == "-"){
      flag = input[i];
      args[flag] = true;
    }
    else if(flag == "")
      return {"error": "Error: You must specify a flag before passing an argument"};
    else
      args[flag] = input[i];
  }

  return {
    "command": command,
    "args"   : args
  };
}

ProcessInput = function(input){return new Promise((done) => {
  input = ParseCommandAndArgs(input);

  if(input["error"]){
    console.log(input["error"]);
    done("prompt"); return;
  }

  var command = input["command"];
  var args    = input["args"];

  if(Object.keys(args).length == 0 && stuff[command]["commands"]){
    Help(command);
    done("prompt"); return;
  }

  if(command in stuff){
    // If the eval returns true, quit the program; otherwise keep it running
    eval(`${command}(args)`)
    .then((o) => {
      if(o) done("close");
      else  done("prompt");
    });
  }else{
    console.log("Unkown command");
    done("prompt"); return;
  }
})}

function Main(){
  console.log("==================== Dolphin =====================");

  rl.setPrompt("> ");
  rl.prompt();

  rl.on("line", function(input){
    ProcessInput(input)
    .then((o) => {
      if(o == "prompt") rl.prompt();
      if(o == "close")  rl.close();
    });
  }).on("close", function() {
    console.log("Quitting the program");
  });
}

Main();

/***** TODO *****/
// Completely replace "RunCommand" with "RunCommandAsync" so that it can easily do the following:
// - Display text on what happens
// - Handle errors
//
// New Feature: remove_service

// Create a zipped archive: tar -zcf temp.tar.gz single_files
