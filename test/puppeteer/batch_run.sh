#!/bin/bash

cmd_to_run="npm run test"
num_iterations=5

for ((i = 1; i <= num_iterations; i++))
do
  echo "Running iteration $i..."
  $cmd_to_run
done

echo "Completed running the cmd $num_iterations times."
