var fs          = require("fs");
var yaml        = require("./yaml");
var readline    = require("readline");
var {spawnSync} = require("child_process");
const SINGLE_FILES_SHA1 = "d254cbb65b7a6a46d96e31ba62a1e8e85124c9ed";

/* Commands are an array of objects
   [ usage     : STRING,
     parameters: OBJECT,
     options   : OBJECT,
     flags     : OBJECT,
     examples  : ARRAY]    */

/* Example stuff
  var child = spawnSync("tar", ["-cf", "a.tar", "single_files"]);
  if(child.stdout.length) console.log("OUT:", child.stdout.toString("utf-8"));
  if(child.stderr.length) console.log("ERR:", child.stderr.toString("utf-8")); */

var stuff = {
  "quit": {
    "helpText": "Quits the program",
    "commands": null
  },
  "help": {
    "helpText": "Displays this screen",
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
  "nconf": {
    "helpText": "Generate a basic NGINX config file",
    "commands": null
  },
  "renew": {
    "helpText": "Renew SSL certificates",
    "commands": null
  },
  "newdb": {
    "helpText": "Creates a new MySQL database from an SQL file",
    "commands": null
  },
  "backup": {
    "helpText": "Backup the database",
    "commands": null
  },
  "restore": {
    "helpText": "Restore the database from most recent backup",
    "commands": null
  },
  "compose": {
    "helpText": "Creates a default template Docker compose file",
    "commands": null
  },

  "wizard": {
    "helpText": "??????????",
    "commands": null
  },

  "nuke_everything": {
    "helpText": "??????????",
    "commands": null
  },

  "view_all": {
    "helpText": "??????????",
    "commands": null
  },

  "create_database": {
    "helpText": "??????????",
    "commands": null
  },

  "backup_database": {
    "helpText": "??????????",
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

/**************************************** HELPER FUNCTIONS ****************************************/
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

function SanityCheck(){
  console.log("Starting sanity check...");

  //

  if(!fs.existsSync("docker-compose.yml")) CreateBaseDockerCompose();
  if(!fs.existsSync("logs"))               fs.mkdirSync("logs");
  if(!fs.existsSync("nginx_conf.d"))       fs.mkdirSync("nginx_conf.d");
  if(!fs.existsSync("single_files"))       fs.mkdirSync("single_files");

  // Get all files in single_files

  var createTar = spawnSync("tar", ["-cf", "a.tar", "single_files"]);
  if(createTar.stderr.length) console.log("ERR:", createTar.stderr.toString("utf-8"));

  var getSha1 = spawnSync("sha1sum", ["a.tar"]);
  if(getSha1.stderr.length) console.log("ERR:", getSha1.stderr.toString("utf-8"));

  var removeTar = spawnSync("rm", ["a.tar"]);
  if(removeTar.stderr.length) console.log("ERR:", removeTar.stderr.toString("utf-8"));

  // Extract the hash
  if(getSha1.stdout.length){
    var checksum = getSha1.stdout.toString("utf-8").split(" ")[0];

    if(checksum == SINGLE_FILES_SHA1){
      console.log("Checksum passed");
    }else{
      console.log("Checksum failed");
      spawnSync("rm"  , ["-rf", "single_files"]);
      spawnSync("wget", ["-O", "temp.tar.gz", "https://tundrafizz.com/a.tar.gz"]);
      spawnSync("tar" , ["-xzf", "temp.tar.gz"]);
      spawnSync("rm"  , ["temp.tar.gz"]);
    }
  }else{
    console.log("Checksum not found");
  }

  console.log("Complete!");
}

function CloneRepository(REPO_URL){
  console.log("Cloning repository:", REPO_URL);
  var child = spawnSync("git", ["clone", REPO_URL]);
  console.log("Complete!");
}

function ConfigureSettings(REPO_NAME){
  // If there's a config.yml file for this repository, edit it
  var possiblePath = `${REPO_NAME}/config.yml`;

  if(!fs.existsSync(possiblePath))
    return;

  console.log("Configuring settings:", REPO_NAME);
  var child = spawnSync("nano", [possiblePath], {"stdio": "inherit", "detached": true});
  console.log("Complete!");
}

function BuildDockerImage(SERVICE_NAME, REPO_NAME){
  console.log("Building Docker image:", REPO_NAME);
  console.log("         into service:", SERVICE_NAME);
  var child = spawnSync("docker", ["build", "-t", SERVICE_NAME, REPO_NAME]);
  console.log("Complete!");
}

function Nconf(serviceName, urlDomain, port){
  console.log("Creating basic NGINX config file:", serviceName);

  var fileName = `nginx_conf.d/${serviceName}.conf`;
  var serverName;

  if(urlDomain == null){
    urlDomain = spawnSync("curl", ["https://api.ipify.org"]).stdout.toString("utf-8");
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

function AddServiceToDockerCompose(SERVICE_NAME){
  console.log("Testing...");

  var doc = yaml.safeLoad(fs.readFileSync("docker-compose.yml", "utf-8"));

  // Create a new object for the services key
  var newService = {
    "image": SERVICE_NAME,
    "volumes": ["./logs:/usr/src/app/log"],
    "depends_on": ["mysql"]
  };

  doc["services"][SERVICE_NAME] = newService;
  fs.writeFileSync("docker-compose.yml", yaml.safeDump(doc), "utf-8");
  console.log("Complete!");
}

function DeployDockerStack(DOCKER_STACK){
  console.log("Deploying to stack:", DOCKER_STACK);
  var child = spawnSync("docker", ["stack", "deploy", "-c", "docker-compose.yml", DOCKER_STACK]);
  console.log("Complete!");
}

function GetDockerContainerIdFromImageName(name){
  // Get the output of all containers (docker container ls), and split it by newline
  var spawn  = spawnSync("docker", ["container", "ls"]);
  var output = spawn.stdout.toString("utf-8").split("\n");
  var containers = [];

  // Search through all containers
  for(var i = 0; i < output.length; i++){
    // Remove all duplicate spaces, because otherwise the .split function below won't work
    // Matches a "space" character (match 1 or more of the preceding token)
    var line = output[i].replace(/ +/g, " ");

    // Break out of this loop if their is no output
    if(line == "") break;

    // There are seven attributes for each container delimited by spaces:
    // Container ID, Image, Command, Created, Status, Ports, Names
    // I only care about the Container ID and Image, so extract those
    var containerId = line.split(" ")[0];
    var imageName   = line.split(" ")[1];

    // If the imageName contains the name I'm looking for, save the containerId
    if(imageName.indexOf(name) > -1) containers.push(containerId);
  }

  // There must be exactly one ID in containers, otherwise this function must give an error
  if     (containers.length == 0) console.log("Error: Couldn't find container");
  else if(containers.length  > 1) console.log("Error: Ambiguous container");
  else                            return containers[0];

  // Return 0 to signify an error
  return 0;
}

function RunCommandInDockerContainer(contanier, command){
  spawnSync("docker", ["exec", contanier, "bash", "-c", command]);
}
/**************************************************************************************************/

/***************************************** MAIN FUNCTIONS *****************************************/
quit = function(){return new Promise((resolve) => {resolve(true);})}

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

wizard = function(args){return new Promise((resolve) => {
  var failed = false;
  if(!("-r" in args)) {failed = true; console.log("You need to do -a");}
  if(!("-s" in args)) {failed = true; console.log("You need to do -s");}
  if(!("-u" in args)) {failed = true; console.log("You need to do -u");}
  if(!("-d" in args)) {failed = true; console.log("You need to do -d");}

  if("--test" in args){
    console.log("Testing the function, overriding all arguments");
    failed = false;
  }

  if(failed){
    console.log("Missing mandatory arguments; aborting");
    resolve();
    return;
  }

  var REPO_URL     = args["-r"];
  var REPO_NAME    = "";
  var SERVICE_NAME = args["-s"];
  var URL_DOMAIN   = args["-u"];
  var DOCKER_STACK = args["-d"];

  if("--test" in args){
    REPO_URL     = "https://github.com/TundraFizz/Docker-Sample-App/////";
    while(REPO_URL[REPO_URL.length-1] == "/") REPO_URL = REPO_URL.substring(0, REPO_URL.length-1);
    REPO_NAME    = REPO_URL.split("/").pop();
    SERVICE_NAME = "second-service";
    URL_DOMAIN   = "mudki.ps";
    DOCKER_STACK = "muh-stack";
  }

  console.log(`REPO_URL    : ${REPO_URL}`);
  console.log(`REPO_NAME   : ${REPO_NAME}`);
  console.log(`SERVICE_NAME: ${SERVICE_NAME}`);
  console.log(`URL_DOMAIN  : ${URL_DOMAIN}`);
  console.log(`DOCKER_STACK: ${DOCKER_STACK}`);

  SanityCheck();
  CloneRepository(REPO_URL);
  ConfigureSettings(REPO_NAME);
  BuildDockerImage(SERVICE_NAME, REPO_NAME);

  Nconf(SERVICE_NAME, URL_DOMAIN, "80"); // Sample repository
  Nconf("phpmyadmin", null, "9000");     // phpMyAdmin

  AddServiceToDockerCompose(SERVICE_NAME);
  // An optional step here is to create or import a database
  DeployDockerStack(DOCKER_STACK);

  // I think this is useful?!?!?
  // docker service update muh-stack_nginx

  console.log("ALL TASKS HAVE BEEN COMPLETED!");
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
  var listOfServices = spawnSync("docker", ["service", "ls", "-q"]);
  var listOfImages   = spawnSync("docker", ["images", "-q"]);

  // From the above commands, convert the stdout buffer into a utf-8 string
  // Then split that string of IDs into an array for each of them
  listOfServices = listOfServices.stdout.toString("utf-8").trim().split("\n");
  listOfImages   = listOfImages.stdout.toString("utf-8").trim().split("\n");

  for(var i = 0; i < listOfServices.length; i++){
    if(listOfServices[i]){
      spawnSync("docker", ["service", "rm", listOfServices[i]]);
      console.log("KILLED SERVICE:", listOfServices[i]);
    }
  }

  // Some images rely on others, so continuously repeat this loop until all images have been removed
  while(true){
    var listOfImages = spawnSync("docker", ["images", "-q"]);
    listOfImages = listOfImages.stdout.toString("utf-8").trim().split("\n");

    // If index zero of listOfImages is blank, then all images have been removed
    if(listOfImages[0] == "")
      break;

    for(var i = 0; i < listOfImages.length; i++){
      if(listOfImages[i]){
        var spawn = spawnSync("docker", ["rmi", "-f", listOfImages[i]]);
        if(spawn.stdout.length) console.log("DELETED IMAGE: ", listOfImages[i]);
      }
    }
  }

  spawnSync("docker", ["system", "prune", "-f"]);
  console.log("SYSTEMS PRUNED");

  spawnSync("docker", ["volume", "prune", "-f"]);
  console.log("VOLUMES PRUNED");

  if(fs.existsSync("docker-compose.yml")){
    spawnSync("rm", ["docker-compose.yml"]);
    console.log("DELETED FILE:  ", "docker-compose.yml");
  }

  if(fs.existsSync("logs")){
    spawnSync("rm", ["-rf", "logs"]);
    console.log("DELETED DIR:   ", "logs");
  }

  if(fs.existsSync("nginx_conf.d")){
    spawnSync("rm", ["-rf", "nginx_conf.d"]);
    console.log("DELETED DIR:   ", "nginx_conf.d");
  }

  if(fs.existsSync("single_files")){
    spawnSync("rm", ["-rf", "single_files"]);
    console.log("DELETED DIR:   ", "single_files");
  }

  // Get all directories that exist in the current working directory,
  // and delete all directories that are considered repositories (contain a Dockerfile)
  // I wonder if I can use "ls" instead of "sh"?
  var listOfDirectories = spawnSync("sh", ["-c", "ls -d */"]);
  listOfDirectories = listOfDirectories.stdout.toString("utf-8").trim().split("\n");

  for(var i = 0; i < listOfDirectories.length; i++){
    var fileList = spawnSync("ls", [listOfDirectories[i]]);
    fileList = fileList.stdout.toString("utf-8").trim().split("\n");

    if(fileList.indexOf("Dockerfile") > -1){
      spawnSync("rm", ["-rf", listOfDirectories[i]]);
      console.log("DELETED DIR:   ", listOfDirectories[i]);
    }
  }

  resolve();
})}

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

ssl = function(args){return new Promise((resolve) => {

  var urlDomain = "mudki.ps";

  var spawn;
  spawn = spawnSync("docker", ["container", "ls"]);

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

  // Nginx container wasn't found
  if(!foundNginx){
    console.log("Couldn't find NGINX container; SSL certificate not generated");
    resolve();
    return;
  }

  // Split the output by space and take the first index which is the ID of the Nginx container
  var nginxContainerId = output.split(" ")[0];

  /* docker run -it --rm --name certbot                      \
     -v muh-stack_ssl:/etc/letsencrypt                       \
     -v muh-stack_ssl_challenge:/ssl_challenge               \
     certbot/certbot certonly                                \
     --register-unsafely-without-email --webroot --agree-tos \
     -w /ssl_challenge --staging -d mudki.ps */

  console.log("Creating an SSL certificate");

  spawn = spawnSync("docker", [
    "run",
    "-i",
    "--rm",
    "--name",
    "certbot",
    "-v",
    "muh-stack_ssl:/etc/letsencrypt",
    "-v",
    "muh-stack_ssl_challenge:/ssl_challenge",
    "certbot/certbot",
    "certonly",
    "--register-unsafely-without-email",
    "--webroot",
    "--agree-tos",
    "-w",
    "/ssl_challenge",
    "-d",
    urlDomain]);

  // console.log("=== OUT ===================================================");
  // if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));
  // console.log("=== ERR ===================================================");
  // if(spawn.stderr.length) console.log(spawn.stderr.toString("utf-8"));
  // console.log("===========================================================");

  // Generate a new Nginx config file for the service
  GenerateNginxConfForSSL("second-service", "mudki.ps");

  // Reload the Nginx config files inside of the Nginx container
  spawn = spawnSync("docker", ["exec", "-i", nginxContainerId, "nginx", "-s", "reload"]);

  resolve();
})}

view_all = function(args){return new Promise((resolve) => {
  var spawn;

  spawnSync("clear");

  spawn = spawnSync("docker", ["stack", "ls"]);
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = spawnSync("docker", ["service", "ls"]);
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = spawnSync("docker", ["container", "ls"]);
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = spawnSync("docker", ["image", "ls"]);
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  spawn = spawnSync("docker", ["volume", "ls"]);
  if(spawn.stdout.length) console.log(spawn.stdout.toString("utf-8"));

  resolve();
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
  spawnSync("docker", ["cp", fileName, `${containerId}:/${fileName}`]);

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
  var dbName      = "coss";
  var dbUsername  = "root";
  var dbPassword  = "fizz";
  var bucketName  = "leif-mysql-backups";
  var currentTime = "currentTime"; // $(date "+%Y-%m-%dT%H-%M-%S");
  var fileName    = `mysql-backup-${currentTime}.sql.gz`;

  var containerId = GetDockerContainerIdFromImageName("mysql");

  var commands = [
    `echo '[client]'                > config.cnf`,
    `echo 'host=localhost'         >> config.cnf`,
    `echo 'user=${dbUsername}'     >> config.cnf`,
    `echo 'password=${dbPassword}' >> config.cnf`,
    `apt-get -qq update`,                                                            // Update the system
    `apt-get -qq install -y python-pip`,                                             // Install the Python package manager
    `pip install -q awscli`,                                                         // Install the AWS Command-line Interface
    `mysqldump --defaults-extra-file=/config.cnf ${dbName} | gzip -9 > ${fileName}`, // Create a backup on the container (the mysqldump command will overwrite any existing mysql-backup file)
    `aws s3 cp ${fileName} s3://${bucketName}`,                                      // Send the backup to my AWS S3 bucket
    `rm ${fileName}`                                                                 // Remove the backup file on the container
  ];

  RunCommandInDockerContainer(containerId, commands[0]);
  RunCommandInDockerContainer(containerId, commands[1]);
  RunCommandInDockerContainer(containerId, commands[2]);
  RunCommandInDockerContainer(containerId, commands[3]);
  RunCommandInDockerContainer(containerId, commands[4]);
  RunCommandInDockerContainer(containerId, commands[5]);
  RunCommandInDockerContainer(containerId, commands[6]);
  RunCommandInDockerContainer(containerId, commands[7]);
  RunCommandInDockerContainer(containerId, commands[8]);
  RunCommandInDockerContainer(containerId, commands[9]);

  resolve();
})}

restore_database = function(args){return new Promise((resolve) => {

  // TODO!


  /*
    echo "Restoring the database..."

    db_username="${1}"
    db_password="${2}"
    db_database="${3}"
    bucket_name="${4}"

    # Save the container that has the word "mysql" in its name as a variable
    mysql_container=$(docker container ls | grep mysql | grep -Eo '^[^ ]+')

    # Save a configuration file for MySQL
    docker exec "${mysql_container}" bash -c "echo '[client]'                 > config.cnf"
    docker exec "${mysql_container}" bash -c "echo 'host=localhost'          >> config.cnf"
    docker exec "${mysql_container}" bash -c "echo 'user=${db_username}'     >> config.cnf"
    docker exec "${mysql_container}" bash -c "echo 'password=${db_password}' >> config.cnf"

    # Update the system
    echo "> apt-get update"
    docker exec "${mysql_container}" bash -c "apt-get -qq update"

    # Install the Python package manager
    echo "> apt-get install -y python-pip"
    docker exec "${mysql_container}" bash -c "apt-get -qq install -y python-pip"

    # Install the AWS Command-line Interface
    echo "> pip install awscli"
    docker exec "${mysql_container}" bash -c "pip install -q awscli"

    db_filename=$(docker exec "${mysql_container}" bash -c "aws s3 ls ${bucket_name} | sort | tail -n 1" | awk '{print $4}')
    echo "> ${db_filename}"

    # Download the backup from S3
    echo "> aws s3 cp s3://leif-mysql-backups/${db_filename} ${db_filename}"
    docker exec "${mysql_container}" bash -c "aws s3 cp s3://leif-mysql-backups/${db_filename} ${db_filename}"

    # Create the database
    echo "> mysql -u ${db_username} -p${db_password} -e 'create database ${db_database}'"
    docker exec "${mysql_container}" bash -c "mysql -u ${db_username} -p${db_password} -e 'create database ${db_database}'"

    # Restore from backup
    echo "> ${command}"
    docker exec "${mysql_container}" bash -c "${command}"

    # Remove the backup file on the container
    echo "> rm ${db_filename}"
    docker exec "${mysql_container}" bash -c "rm ${db_filename}"
  */
})}
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
// Restore a database
// Display text on what happens
// Handle errors

// Restart a service
// spawnSync("docker", ["service", "update", "muh-stack_nginx"]);
