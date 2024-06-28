#!/bin/bash

# Configuration
FRONTEND_IMAGE="dockerhub88/frontend:latest"
BACKEND_IMAGE="dockerhub88/backend:latest"
K8S_DIR="k8s"  # Directory containing your Kubernetes YAML files
DOCKER_SECRET="docker-registry-secret"
DOCKER_SERVER="https://index.docker.io/v1/"

# Initialize counters
total_steps=11
passed_steps=0

# Ensure Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Step 1/11: Docker is not running. Please start Docker and try again."
    exit 1
else
    echo "Step 1/11: Docker is running."
    passed_steps=$((passed_steps + 1))
fi

# Ensure kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "Step 2/11: kubectl could not be found. Please install kubectl and try again."
    exit 1
else
    echo "Step 2/11: kubectl is installed."
    passed_steps=$((passed_steps + 1))
fi

# Get Docker credentials from Kubernetes secret
echo "Step 3/11: Retrieving Docker credentials from Kubernetes secret..."
DOCKER_CONFIG=$(kubectl get secret $DOCKER_SECRET -o jsonpath='{.data.\.dockerconfigjson}' | base64 --decode)
if [ -z "$DOCKER_CONFIG" ]; then
    echo "Step 3/11: Failed to retrieve Docker credentials."
    exit 1
else
    echo "Step 3/11: Docker credentials retrieved successfully."
    passed_steps=$((passed_steps + 1))
    echo "$DOCKER_CONFIG" > ~/.docker/config.json
fi

# Debug: Print the Docker config content
echo "Step 4/11: Docker config content:"
cat ~/.docker/config.json

# Extract Docker username and password directly
DOCKER_USERNAME=$(jq -r ".auths[\"docker.io\"].username" ~/.docker/config.json)
DOCKER_PASSWORD=$(jq -r ".auths[\"docker.io\"].password" ~/.docker/config.json)


# Check if username and password were correctly extracted
if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
    echo "Step 5/11: Failed to extract Docker username or password."
    exit 1
else
    echo "Step 5/11: Docker username and password extracted successfully."
    passed_steps=$((passed_steps + 1))
fi

# Login to Docker
echo "Step 6/11: Logging in to Docker..."
if echo "$DOCKER_PASSWORD" | docker login "$DOCKER_SERVER" -u "$DOCKER_USERNAME" --password-stdin; then
    echo "Step 6/11: Docker login successful."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 6/11: Docker login failed."
    exit 1
fi

# Build and push frontend Docker image
echo "Step 7/11: Building frontend Docker image..."
if docker build -t $FRONTEND_IMAGE -f Dockerfile.frontend .; then
    echo "Step 7/11: Frontend Docker image built successfully."s
    passed_steps=$((passed_steps + 1))
else
    echo "Step 7/11: Failed to build frontend Docker image."
    exit 1
fi

echo "Step 8/11: Pushing frontend Docker image to Docker registry..."
if docker push $FRONTEND_IMAGE; then
    echo "Step 8/11: Frontend Docker image pushed successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 8/11: Failed to push frontend Docker image."
    exit 1
fi

# Build and push backend Docker image
echo "Step 9/11: Building backend Docker image..."
if docker build -t $BACKEND_IMAGE -f Dockerfile.backend .; then
    echo "Step 9/11: Backend Docker image built successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 9/11: Failed to build backend Docker image."
    exit 1
fi

echo "Step 10/11: Pushing backend Docker image to Docker registry..."
if docker push $BACKEND_IMAGE; then
    echo "Step 10/11: Backend Docker image pushed successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 10/11: Failed to push backend Docker image."
    exit 1
fi

# Delete existing Kubernetes deployments and services
echo "Deleting existing Kubernetes deployments and services..."
if kubectl delete -f $K8S_DIR --ignore-not-found; then
    echo "Existing Kubernetes deployments and services deleted."
    passed_steps=$((passed_steps + 1))
else
    echo "Failed to delete existing Kubernetes deployments and services."
    exit 1
fi

# Apply new Kubernetes configurations
echo "Applying new Kubernetes configurations..."
if kubectl apply -f $K8S_DIR; then
    echo "New Kubernetes configurations applied."
    passed_steps=$((passed_steps + 1))
else
    echo "Failed to apply new Kubernetes configurations."
    exit 1
fi

# Summary
echo "Deployment completed successfully."
echo "$passed_steps out of $total_steps steps passed successfully."
watch -n 1 kubectl get pods
