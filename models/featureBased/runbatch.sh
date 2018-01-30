#!/bin/bash
# Need to use gnu parallel to limit number of these running at once (for memory reasons)
# find bdaInput/*.csv | parallel -j 4 --bar "sh runbatch.sh" {}

# Run with file input
webppl BDA.wppl --param-store file --param-id "$(basename "$1" .csv)" --require ./refModule/ -- --gameid "$(basename "$1" .csv)" > "out.tmp"
