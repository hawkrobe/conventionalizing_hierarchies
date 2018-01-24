#!/bin/bash
for f in ./bdaInput/*.csv; do
    webppl BDA.wppl --param-store file --param-id "${f%.csv}" --require ./refModule/ -- --gameid "$(basename "$f" .csv)" &
    sleep 0.5s
done

wait
