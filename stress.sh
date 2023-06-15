#!/bin/bash

rm -f stop
while [ ! -f ./stop ]
do
    while [ -f ./pause ]
    do
        sleep 1
    done

    yarn test
done
