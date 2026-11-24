# Desk on the Azure VM

Use `compose.yaml` with `compose.vm.yaml` and a distinct project name. The overlay requires Docker Compose 2.24.4 or later. It keeps the existing frontend image and `/api` proxy. The frontend binds to VM loopback port 3500 by default. Configure the VM's edge Caddy to forward `desk.gen7fuel.com` there with the original `Host` header. MongoDB and the API use the Desk network.

Set `FRONTEND_IMAGE` and `BACKEND_IMAGE` to reviewed image references. Set `DESK_VM_ENV_FILE` to the dedicated Desk VM runtime environment file and keep it outside the checkout. Set `GEN7_DATA_ROOT` to the mounted data disk. After verifying the mount, create `desk/mongo`, `desk/pos-data` and `desk/pos-archive` beneath it. Give the MongoDB image access to its data directory and Desk's API user (UID 1001) access to the POS directories. Compose bind mounts reject missing paths. Gate the Docker daemon itself on the verified data disk mount before deploying this overlay, because its service restart policies can start existing containers during daemon startup.

For local checks, select fresh disk directories, a unique Compose project and an environment file with synthetic values. Leave Azure credentials absent. The default service set omits the CDN backup worker. For a real Desk API rehearsal, additionally override `networks.desk.internal` to `true` in a local Compose override before starting the project. Desk login and POS location lookups use the public Hub origin. Running them against a synthetic Hub requires a fixture-only HTTPS endpoint trusted by the isolated client and resolving that hostname inside the test network. Until that fixture is available, exercise API health through Caddy and use the Desk auth and POS suites to check mocked Hub calls.

```sh
docker compose -p desk-vm -f compose.yaml -f compose.vm.yaml config --quiet
curl --fail -H 'Host: desk.gen7fuel.com' http://127.0.0.1:3500/api/health
```

Once the host mount is verified and Desk backup ownership has been explicitly handed over, enable the `cdn-backup` profile in the VM startup configuration. Keep its existing Azure source and archive destination settings. To hand ownership back, explicitly stop the VM backup service before enabling the other host. A frontend-only update can use `up -d --no-deps --wait caddy` after pulling the reviewed frontend image and checking the mount. This leaves the API, database and backup worker on their current releases.

## Desk POS ownership

Set `POS_WRITES_ENABLED=false` in the runtime environment file on every standby. Set `POS_WRITES_ENABLED=true` on the designated POS writer after verifying the predecessor has stopped and the data and archive paths are on the verified disk. Recreate the API after changing its environment. Check the new container's effective setting before opening the write routes.

The standby can read accepted reports. Its scheduled importer stays off and its POS mutation requests return HTTP 503. For a writer change on the old VPS, account for the production deployment workflow recreating `backend/.env`. The switch must be applied persistently before a production handover.
