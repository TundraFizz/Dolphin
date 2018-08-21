# Dolphin

For private repositories, make sure your server has access to it by following these three steps:
  1. `ssh-keygen`
  2. `cat ~/.ssh/id_rsa.pub`
  3. Add the above output to: https://github.com/settings/keys

In order for Dolphin to work properly with your Node.JS application, you will need to have these three files in the root directory:
  * Dockerfile
  * config.yml (optional)
  * database.sql  (optional)

Sample Dockerfile
```
FROM node:carbon
WORKDIR /usr/src/app
COPY package.json .

RUN apt-get update && \
    npm install --production

COPY . .
EXPOSE 80
CMD ["npm", "start"]
```

# Usage

`node main.js`

# [Installing Node.js](https://nodejs.org/en/download/package-manager/)

```
curl --silent --location https://rpm.nodesource.com/setup_8.x | sudo bash -
sudo yum -y install nodejs

bash setup.sh

docker swarm init
```
