#!/bin/bash

# Define the log file
LOG_FILE="logfile.log"

# Check if the log file exists; if not, create it
if [ ! -f $LOG_FILE ]; then
  touch $LOG_FILE
fi

# Empty the file.
> $LOG_FILE

# Get all pods in the default namespace
pods=$(kubectl get pods -n default -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n')

# Loop through all pods in the default namespace
for pod in $pods; do
  echo "Logging from pod $pod in namespace default" >> $LOG_FILE
  # Append the logs of the current pod to the log file
  kubectl logs -n default $pod >> $LOG_FILE 2>&1

  # Check if the pod has multiple containers and get logs for each
  containers=$(kubectl get pod -n default $pod -o jsonpath='{.spec.containers[*].name}' | tr ' ' '\n')
  for container in $containers; do
    echo "Logging from container $container in pod $pod in namespace default" >> $LOG_FILE
    kubectl logs -n default $pod -c $container >> $LOG_FILE 2>&1
  done
done

echo "Logs collected in $LOG_FILE"
