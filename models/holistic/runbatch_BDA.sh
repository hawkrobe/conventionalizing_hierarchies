#!/bin/bash
# Need to use gnu parallel to limit number of these running at once (for memory reasons)
# find ../bdaInput/*.csv | parallel -j 32 --bar "sh runbatch_BDA.sh" {}
# We sleep a bit to prevent writing at the same time...

# Run with file input
WEBPPL_PARAM_PATH='./bdaOutput/'; echo $WEBPPL_PARAM_PATH; 
webppl BDA.wppl --param-store file --param-id "$(basename "$1" .csv)" --require ./refModule/ -- --gameid "$(basename "$1" .csv)" > "out.tmp"; 
