#!/bin/bash
curl -s \
  -H "API-TOKEN: ${BOT_TOKEN_SIMULATION}" \
  -H "PLUGIN-NAME: DialogBTP" \
  http://localhost:5000/hook