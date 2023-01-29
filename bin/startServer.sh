#!/bin/bash
. env/.env.bash.production
exec node --unhandled-rejections=strict bin/www