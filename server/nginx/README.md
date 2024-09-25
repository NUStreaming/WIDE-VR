## Installation

- Save a copy of your current Nginx configuration parameters:
    - Use cmd `nginx -V` to view current config params

- Backup existing Nginx config & uninstall:
    - See this guide: `https://www.cyberciti.biz/faq/remove-uninstall-nginx-from-ubuntu-debian-linux-apt-get-command/`
        - Note: If the existing `/etc/nginx/modules` folder is a shortcut, suggest to separately save it as the actual module files may not be saved in the tar

- Download & build from source `nginx-1.25.3`:
    - Create tmp Nginx installation folder
    - See this guide to compile & install from source: `https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/#downloading-the-sources`
        - Note: Use the config params saved earlier + Add `--with-http_v3_module` before compiling

## Setup and Testing

- Launch Nginx using `sudo nginx -c <PATH_TO_PROJECT>/server/nginx/config/nginx.conf` (note that the absolute path must be used)
- Reload Nginx using `sudo nginx -c <PATH_TO_PROJECT>/server/nginx/config/nginx.conf -s reload`, if the configuration has changed
