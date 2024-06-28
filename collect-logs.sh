#!/bin/bash

# Define the log file
LOG_FILE="logfile.log"

# Check if the log file exists; if not, create it
if [ ! -f $LOG_FILE ]; then
  touch $LOG_FILE
fi

# Get all namespaces, excluding system namespaces like kube-system, etc.
namespaces=$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | grep -vE '^(kube-system|kube-public|kube-node-lease)$')

# Loop through all namespaces
for ns in $namespaces; do
  # Get all pods in the current namespace
  pods=$(kubectl get pods -n $ns -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n')

  # Loop through all pods in the current namespace
  for pod in $pods; do
    echo "Logging from pod $pod in namespace $ns" >> $LOG_FILE
    # Append the logs of the current pod to the log file
    kubectl logs -n $ns $pod >> $LOG_FILE 2>&1

    # Check if the pod has multiple containers and get logs for each
    containers=$(kubectl get pod -n $ns $pod -o jsonpath='{.spec.containers[*].name}' | tr ' ' '\n')
    for container in $containers; do
      echo "Logging from container $container in pod $pod in namespace $ns" >> $LOG_FILE
      kubectl logs -n $ns $pod -c $container >> $LOG_FILE 2>&1
    done
  done
done

echo "Logs collected in $LOG_FILE"
