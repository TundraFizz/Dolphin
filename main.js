var fs          = require("fs");
var yaml        = require("./yaml");
var readline    = require("readline");
var {spawnSync} = require("child_process");
const SINGLE_FILES_SHA1   = "d254cbb65b7a6a46d96e31ba62a1e8e85124c9ed";
const SINGLE_FILES_TAR_GZ = "https://tundrafizz.com/a.tar.gz";

/* Commands are an array of objects [
  usage     : STRING,
  parameters: OBJECT,
  options   : OBJECT,
  flags     : OBJECT,
  examples  : ARRAY]    */

/* Example stuff
  var spawn = RunCommand("tar -cf temp.tar single_files");
  if(spawn.stdout.length) console.log("OUT:", spawn.stdout.toString("utf-8"));
  if(spawn.stderr.length) console.log("ERR:", spawn.stderr.toString("utf-8")); */

var stuff = {
  "wizard": {
    "helpText": "??????????",
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
  }
};

function completer(line){
  var autoComplete = [];

  for(key in stuff)
    autoComplete.push(key);

  var hits = autoComplete.filter(function(c){
    return c.indexOf(line) == 0;
  });

  return [hits.length ? hits : autoComplete, line]; // Show all if none found
}

var rl = readline.createInterface({
  "input": process.stdin,
  "output": process.stdout,
  "completer": completer
});

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

/**************************************** UTILITY FUNCTIONS ***************************************/
function RunCommand(command){
  var array = command.split(" ");
  var cmd   = array[0];
  var args  = [];

  for(var i = 1; i < array.length; i++)
    args.push(array[i]);

  return spawnSync(cmd, args);
}

function RunCommandInDockerContainer(container, command){
  var spawn = spawnSync("docker", ["exec", container, "bash", "-c", command]);

  console.log(">>>", command);

  if(spawn.stdout.length){
    console.log("===== OUT ==============================");
    console.log(spawn.stdout.toString("utf-8").trim());
  }

  if(spawn.stderr.length){
    console.log("===== ERR ==============================");
    console.log(spawn.stderr.toString("utf-8").trim());
  }

  return spawn;
}

function GetDockerContainerIdFromImageName(name){
  // Get the output of all containers (docker container ls), trim the string (remove spaces/newlines from ends), and split it by newline
  var spawn  = RunCommand("docker container ls");
  var output = spawn.stdout.toString("utf-8").trim().split("\n");
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
        "image": "mysql",
        "volumes": ["sql_storage:/var/lib/mysql"],
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
/**************************************************************************************************/

/**************************************** HELPER FUNCTIONS ****************************************/
function Initialize(dockerStackName){
  if(fs.existsSync("docker-compose.yml"))
    return;

  console.log("Starting initialization...");

  if(!fs.existsSync("docker-compose.yml")) CreateBaseDockerCompose();
  if(!fs.existsSync("logs"))               fs.mkdirSync("logs");
  if(!fs.existsSync("nginx_conf.d"))       fs.mkdirSync("nginx_conf.d");
  if(!fs.existsSync("single_files"))       fs.mkdirSync("single_files");

  // Get all files in single_files

  var createTar = RunCommand("tar -cf temp.tar single_files");
  if(createTar.stderr.length) console.log("ERR:", createTar.stderr.toString("utf-8"));

  var getSha1 = RunCommand("sha1sum temp.tar");
  if(getSha1.stderr.length) console.log("ERR:", getSha1.stderr.toString("utf-8"));

  var removeTar = RunCommand("rm temp.tar");
  if(removeTar.stderr.length) console.log("ERR:", removeTar.stderr.toString("utf-8"));

  // Extract the hash
  if(getSha1.stdout.length){
    var checksum = getSha1.stdout.toString("utf-8").split(" ")[0];

    if(checksum == SINGLE_FILES_SHA1){
      console.log("Checksum passed");
    }else{
      console.log("Checksum failed");
      RunCommand("rm -rf single_files");
      RunCommand(`wget -O temp.tar.gz ${SINGLE_FILES_TAR_GZ}`);
      RunCommand("tar -xzf temp.tar.gz");
      RunCommand("rm temp.tar.gz");
    }
  }else{
    console.log("Checksum not found");
  }
}

function Nconf(serviceName, urlDomain, port){
  console.log("Creating basic NGINX config file:", serviceName);

  var fileName = `nginx_conf.d/${serviceName}.conf`;
  var serverName;

  if(urlDomain == null){
    urlDomain = RunCommand("curl https://api.ipify.org").stdout.toString("utf-8");
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

  console.log("Complete!");
}

function DeployDockerStack(dockerStack){
  console.log("Deploying to stack:", dockerStack);
  var spawn = RunCommand(`docker stack deploy -c docker-compose.yml ${dockerStack}`);
  console.log("Complete!");
}

function ConfigureMySqlContainer(dbUsername, dbPassword){
  var attempts = 1;
  var mysqlContainerId = null;

  console.log("Getting MySQL container...");

  // Try 60 times (once per second)
  while(attempts < 60 && !mysqlContainerId){
    var result = GetDockerContainerIdFromImageName("mysql:");

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
  var host        = "localhost";
  var user        = "root";
  var password    = "fizz";
  var commands    = [
    `apt-get -qq update`,                              // Update the system
    `apt-get -qq install -y apt-utils`,                // Install apt-utils
    `apt-get -qq install -y python-pip`,               // Install the Python package manager
    `pip install -q awscli`,                           // Install the AWS Command-line Interface

    `echo '[mysql]'               > ${mySqlConfig}`, // Create config file
    `echo 'host=${host}'         >> ${mySqlConfig}`, // Append to the config file
    `echo 'user=${user}'         >> ${mySqlConfig}`,
    `echo 'password=${password}' >> ${mySqlConfig}`,
    `echo ''                     >> ${mySqlConfig}`,
    `echo '[mysqldump]'          >> ${mySqlConfig}`,
    `echo 'user=${user}'         >> ${mySqlConfig}`,
    `echo 'password=${password}' >> ${mySqlConfig}`
  ];

  // --no-install-recommends apt-utils

  for(var i = 0; i < commands.length; i++)
    RunCommandInDockerContainer(mysqlContainerId, commands[i]);
}

function CloneRepository(repoUrl){
  console.log("Cloning repository:", repoUrl);
  var spawn = RunCommand(`git clone ${repoUrl}`);
  console.log("Complete!");
}

function ConfigureSettings(repoName){
  // If there's a config.yml file for this repository, edit it
  var possiblePath = `${repoName}/config.yml`;

  if(!fs.existsSync(possiblePath))
    return;

  console.log("Configuring settings:", repoName);
  var spawn = spawnSync("nano", [possiblePath], {"stdio": "inherit", "detached": true});
  console.log("Complete!");
}

function BuildDockerImage(serviceName, repoName){
  console.log("Building Docker image:", repoName);
  console.log("         into service:", serviceName);
  var spawn = RunCommand(`docker build -t ${serviceName} ${repoName}`);
  console.log("Complete!");
}

function AddServiceToDockerCompose(serviceName){
  console.log("Testing...");

  var doc = yaml.safeLoad(fs.readFileSync("docker-compose.yml", "utf-8"));

  // Create a new object for the services key
  var newService = {
    "image": serviceName,
    "volumes": ["./logs:/usr/src/app/log"],
    "depends_on": ["mysql"]
  };

  doc["services"][serviceName] = newService;
  fs.writeFileSync("docker-compose.yml", yaml.safeDump(doc), "utf-8");
  console.log("Complete!");
}

function GenerateNginxConfForSSL(serviceName, urlDomain){
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
}
/**************************************************************************************************/

/***************************************** MAIN FUNCTIONS *****************************************/
wizard = function(args){return new Promise((resolve) => {
  var dockerStackName = "muh-stack";

  if(!fs.existsSync("docker-compose.yml")){
    Initialize(dockerStackName);
    Nconf("phpmyadmin", null, "9000");
    DeployDockerStack(dockerStackName);
    ConfigureMySqlContainer("root", "fizz");
  }

  var repoUrl     = "";
  var repoName    = "";
  var serviceName = "";
  var urlDomain   = "";
  var port        = "";
  var go          = false;

  if("--test" in args){
    repoUrl     = "https://github.com/TundraFizz/Docker-Sample-App";
    urlDomain   = "mudki.ps";
    go          = true;

    // Remove all trailing forward slashes from the URL
    while(repoUrl[repoUrl.length-1] == "/") repoUrl = repoUrl.substring(0, repoUrl.length-1);

    // Extract the repository's name from the URL
    repoName    = repoUrl.split("/").pop();

    // Set the service's name to the lowercase version of the repository's name
    serviceName = repoName.toLowerCase();
  }

  // Skip all of this if I'm just initializing
  if(go){
    CloneRepository(repoUrl);
    ConfigureSettings(repoName);
    BuildDockerImage(serviceName, repoName);
    AddServiceToDockerCompose(serviceName);
    Nconf(serviceName, urlDomain, "80");
    DeployDockerStack(dockerStackName);
    RunCommand(`docker service update muh-stack_nginx`);
  }

  resolve();
})}

nuke_everything = function(args){return new Promise((resolve) => {
  // Kill all Docker services
  // Delete all Docker images
  // Delete the following:
  //   - FILE: docker-compose.yml
  //   - DIR : logs
  //   - DIR : nginx_conf.d
  //   - DIR : single_files
  // Every directory that's a repository

  // Run the commands to get the lists of Docker services and images
  var listOfServices = RunCommand("docker service ls -q");
  var listOfImages   = RunCommand("docker images -q");

  // From the above commands, convert the stdout buffer into a utf-8 string
  // Then split that string of IDs into an array for each of them
  listOfServices = listOfServices.stdout.toString("utf-8").trim().split("\n");
  listOfImages   = listOfImages.stdout.toString("utf-8").trim().split("\n");

  for(var i = 0; i < listOfServices.length; i++){
    if(listOfServices[i]){
      RunCommand(`docker service rm ${listOfServices[i]}`);
      console.log("KILLED SERVICE:", listOfServices[i]);
    }
  }

  // Some images rely on others, so continuously repeat this loop until all images have been removed
  while(true){
    var listOfImages = RunCommand("docker images -q");
    listOfImages = listOfImages.stdout.toString("utf-8").trim().split("\n");

    // If index zero of listOfImages is blank, then all images have been removed
    if(listOfImages[0] == "")
      break;

    for(var i = 0; i < listOfImages.length; i++){
      if(listOfImages[i]){
        var spawn = RunCommand(`docker rmi -f ${listOfImages[i]}`);
        if(spawn.stdout.length) console.log("DELETED IMAGE: ", listOfImages[i]);
      }
    }
  }

  RunCommand("docker system prune -f");
  console.log("SYSTEMS PRUNED");

  RunCommand("docker volume prune -f");
  console.log("VOLUMES PRUNED");

  if(fs.existsSync("docker-compose.yml")){
    RunCommand("rm docker-compose.yml");
    console.log("DELETED FILE:  ", "docker-compose.yml");
  }

  if(fs.existsSync("logs")){
    RunCommand("rm -rf logs");
    console.log("DELETED DIR:   ", "logs");
  }

  if(fs.existsSync("nginx_conf.d")){
    RunCommand("rm -rf nginx_conf.d");
    console.log("DELETED DIR:   ", "nginx_conf.d");
  }

  if(fs.existsSync("single_files")){
    RunCommand("rm -rf single_files");
    console.log("DELETED DIR:   ", "single_files");
  }

  // Get all directories that exist in the current working directory,
  // and delete all directories that are considered repositories (contain a Dockerfile)
  // I wonder if I can use "ls" instead of "sh"?
  var listOfDirectories = spawnSync("sh", ["-c", "ls -d */"]);
  listOfDirectories = listOfDirectories.stdout.toString("utf-8").trim().split("\n");

  for(var i = 0; i < listOfDirectories.length; i++){
    var fileList = RunCommand(`ls ${listOfDirectories[i]}`);
    fileList = fileList.stdout.toString("utf-8").trim().split("\n");

    if(fileList.indexOf("Dockerfile") > -1){
      RunCommand(`rm -rf ${listOfDirectories[i]}`);
      console.log("DELETED DIR:   ", listOfDirectories[i]);
    }
  }

  resolve();
})}

view_all = function(args){return new Promise((resolve) => {
  var spawn;

  RunCommand("clear");

  spawn = RunCommand("docker stack ls");
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = RunCommand("docker service ls");
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = RunCommand("docker container ls");
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = RunCommand("docker container ls");
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = RunCommand("docker volume ls");
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  resolve();
})}

ssl = function(args){return new Promise((resolve) => {
  var urlDomain = "mudki.ps";
  var spawn = RunCommand("docker container ls");

  // Get the entire output and split it by newline
  var output = spawn.stdout.toString("utf-8").split("\n");
  var foundNginx = false;

  // Search for the Nginx container
  for(var i = 0; i < output.length; i++){
    if(output[i].indexOf("nginx:") > -1){
      output = output[i];
      foundNginx = true;
      break;
    }
  }

  // The NGINX container wasn't found
  if(!foundNginx){
    console.log("Couldn't find NGINX container; SSL certificate not generated");
    resolve();
    return;
  }

  // Split the output by space and take the first index which is the ID of the Nginx container
  var nginxContainerId = output.split(" ")[0];

  console.log("Creating an SSL certificate");

  /* docker run -it --rm --name certbot                      \
     -v muh-stack_ssl:/etc/letsencrypt                       \
     -v muh-stack_ssl_challenge:/ssl_challenge               \
     certbot/certbot certonly                                \
     --register-unsafely-without-email --webroot --agree-tos \
     -w /ssl_challenge --staging -d mudki.ps */

  spawn = RunCommand(`docker run -i --rm --name certbot -v muh-stack_ssl:/etc/letsencrypt -v muh-stack_ssl_challenge:/ssl_challenge certbot/certbot certonly --register-unsafely-without-email --webroot --agree-tos -w /ssl_challenge -d ${urlDomain}`);

  console.log("=== OUT ===================================================");
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));
  console.log("=== ERR ===================================================");
  if(spawn.stderr.length) console.log(spawn.stderr.toString("utf-8"));
  console.log("===========================================================");

  // Generate a new Nginx config file for the service
  GenerateNginxConfForSSL("yolo-swag", "mudki.ps");

  // Restart the NGINX container
  RunCommand(`docker container restart ${nginxContainerId}`);

  // I DON'T THINK THIS WORKS, ONLY RESTARTING THE CONTAINER DOES!
  // Reload the Nginx config files inside of the Nginx container
  // spawn = RunCommand(`docker exec -i ${nginxContainerId} nginx -s reload`);

  resolve();
})}

renew_ssl = function(args){return new Promise((resolve) => {
  // TODO
  ;
})}

create_database = function(args){return new Promise((resolve) => {
  var containerId  = GetDockerContainerIdFromImageName("mysql");

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
    `mysql -u ${dbUsername} -p${dbPassword} -e 'create database ${dbName}'`, // Create the database
    `mysql -u ${dbUsername} -p${dbPassword} ${dbName} < ${fileName}`,        // Import data from the .sql file into the database
    `rm /${fileName}`                                                        // Remove the .sql file from the container
  ];

  RunCommandInDockerContainer(containerId, commands[0]);
  RunCommandInDockerContainer(containerId, commands[1]);
  RunCommandInDockerContainer(containerId, commands[2]);

  resolve();
})}

backup_database = function(args){return new Promise((resolve) => {
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
    `mysqldump ${dbName} | gzip --best > ${fileName}`, // Create a backup on the container with the best compression method
    `aws s3 cp ${fileName} s3://${bucketName}`,        // Upload the backup to my AWS S3 bucket
    `rm ${fileName}`                                   // Remove the backup file on the container
  ];

  for(var i = 0; i < commands.length; i++)
    RunCommandInDockerContainer(containerId, commands[i]);

  resolve();
})}

restore_database = function(args){return new Promise((resolve) => {
  var dbName      = "coss";
  var dbUsername  = "root";
  var dbPassword  = "fizz";
  var bucketName  = "leif-mysql-backups";

  var fileName    = null;
  var containerId = GetDockerContainerIdFromImageName("mysql");

  var command = `aws s3 ls leif-mysql-backups`;
  var spawn   = RunCommandInDockerContainer(containerId, command);
  // var spawn   = RunCommand(`docker exec ${containerId} bash -c ${command}`);

  if(spawn.stdout.length){
    // A list of files will be returned in alphanumeric order. This means that the most
    // recent MySQL backup file will be at the end. Trim the string to remove newlines,
    // split the string by newline, and pop the final result
    fileName = spawn.stdout.toString("utf-8").trim().split("\n").pop();

    // The result will be something like this:
    // 2018-08-10 21:14:19     4992     mysql-backup-2018-08-10T21-14-17.sql.gz
    // I only need the file name at the end, so split by space and pop the final result
    fileName = fileName.split(" ").pop();
  }

  command = `aws s3 cp s3://leif-mysql-backups/${fileName} ${fileName}`;
  RunCommandInDockerContainer(containerId, command);
  // RunCommand(`docker exec ${containerId} bash -c ${command}`);

  // mysql -u root -pfizz -e 'create database lmaoitworks'
  // command = `mysql -u ${dbUsername} -p${dbPassword} -e 'create database ${dbName}'`;
  command = `mysql -e 'create database ${dbName}'`;
  RunCommandInDockerContainer(containerId, command);
  // RunCommand(`docker exec ${containerId} bash -c ${command}`);

  // zcat mysql-backup-2018-08-10T21-14-17.sql.gz | mysql -u 'root' -p your_database
  // zcat mysql-backup-2018-08-10T21-14-17.sql.gz | mysql -u 'root' -pfizz lmaoitworks
  // zcat mysql-backup-2018-08-10T21-14-17.sql.gz | mysql lmaoitworks
  command = `zcat ${fileName} | mysql ${dbName}`;
  RunCommandInDockerContainer(containerId, command);
  // RunCommand(`docker exec ${containerId} bash -c ${command}`);

  command = `rm ${fileName}`;
  RunCommandInDockerContainer(containerId, command);
  // RunCommand(`docker exec ${containerId} bash -c ${command}`);

  resolve();
})}

help = function(){return new Promise((resolve) => {
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
  resolve();
})}

quit = function(){return new Promise((resolve) => {resolve(true);})}
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

ProcessInput = function(input){return new Promise((resolve) => {
  input = ParseCommandAndArgs(input);

  if(input["error"]){
    console.log(input["error"]);
    resolve("prompt"); return;
  }

  var command = input["command"];
  var args    = input["args"];

  if(Object.keys(args).length == 0 && stuff[command]["commands"]){
    Help(command);
    resolve("prompt"); return;
  }

  if(command in stuff){
    // If the eval returns true, quit the program; otherwise keep it running
    eval(`${command}(args)`)
    .then((o) => {
      if(o) resolve("close");
      else  resolve("prompt");
    });
  }else{
    console.log("Unkown command");
    resolve("prompt"); return;
  }
})}

function Main(){
  console.log("==================== Dolphin ====================");

  rl.setPrompt("> ");
  rl.prompt();

  rl.on("line", function(input){
    ProcessInput(input)
    .then(o => {
      if(o == "prompt") rl.prompt();
      if(o == "close")  rl.close();
    });
  }).on("close", function() {
    console.log("Quitting the program");
  });
}

Main();

/***** TODO *****/
// Display text on what happens
// Handle errors

// Restart a service
// RunCommand(`docker service update muh-stack_nginx`);
