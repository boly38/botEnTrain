#!/bin/bash
curl -s \
  -H "API-TOKEN: ${TOKEN_SIMULATION}" \
  -H "PLUGIN-NAME: PlantnetBTP" \
  http://localhost:5000/hook