#!/bin/bash

# Configuration
FRONTEND_IMAGE="dockerhub88/frontend:latest"
BACKEND_IMAGE="dockerhub88/backend:latest"
MODEL_IMAGE="dockerhub88/model-trainer:latest"  # New model container
K8S_DIR="k8s"  # Directory containing your Kubernetes YAML files
DOCKER_SECRET="docker-registry-secret"
DOCKER_SERVER="https://index.docker.io/v1/"

# Initialize counters
total_steps=14
passed_steps=0

# Ensure Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Step 1/14: Docker is not running. Please start Docker and try again."
    exit 1
else
    echo "Step 1/14: Docker is running."
    passed_steps=$((passed_steps + 1))
fi

# Ensure kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "Step 2/14: kubectl could not be found. Please install kubectl and try again."
    exit 1
else
    echo "Step 2/14: kubectl is installed."
    passed_steps=$((passed_steps + 1))
fi

# Get Docker credentials from Kubernetes secret
echo "Step 3/14: Retrieving Docker credentials from Kubernetes secret..."
DOCKER_CONFIG=$(kubectl get secret $DOCKER_SECRET -o jsonpath='{.data.\.dockerconfigjson}' | base64 --decode)
if [ -z "$DOCKER_CONFIG" ]; then
    echo "Step 3/14: Failed to retrieve Docker credentials."
    exit 1
else
    echo "Step 3/14: Docker credentials retrieved successfully."
    passed_steps=$((passed_steps + 1))
    echo "$DOCKER_CONFIG" > ~/.docker/config.json
fi

# Extract Docker username and password directly
echo "Step 4/14: Extracting Docker credentials..."
DOCKER_USERNAME=$(jq -r ".auths[\"docker.io\"].username" ~/.docker/config.json)
DOCKER_PASSWORD=$(jq -r ".auths[\"docker.io\"].password" ~/.docker/config.json)

if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
    echo "Step 4/14: Failed to extract Docker username or password."
    exit 1
else
    echo "Step 4/14: Docker username and password extracted successfully."
    passed_steps=$((passed_steps + 1))
fi

# Login to Docker
echo "Step 5/14: Logging in to Docker..."
if echo "$DOCKER_PASSWORD" | docker login "$DOCKER_SERVER" -u "$DOCKER_USERNAME" --password-stdin; then
    echo "Step 5/14: Docker login successful."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 5/14: Docker login failed."
    exit 1
fi

# Build and push frontend Docker image
echo "Step 6/14: Building frontend Docker image..."
if docker build -t $FRONTEND_IMAGE -f Dockerfile.frontend .; then
    echo "Step 6/14: Frontend Docker image built successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 6/14: Failed to build frontend Docker image."
    exit 1
fi

echo "Step 7/14: Pushing frontend Docker image..."
if docker push $FRONTEND_IMAGE; then
    echo "Step 7/14: Frontend Docker image pushed successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 7/14: Failed to push frontend Docker image."
    exit 1
fi

# Build and push backend Docker image
echo "Step 8/14: Building backend Docker image..."
if docker build -t $BACKEND_IMAGE -f Dockerfile.backend .; then
    echo "Step 8/14: Backend Docker image built successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 8/14: Failed to build backend Docker image."
    exit 1
fi

echo "Step 9/14: Pushing backend Docker image..."
if docker push $BACKEND_IMAGE; then
    echo "Step 9/14: Backend Docker image pushed successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 9/14: Failed to push backend Docker image."
    exit 1
fi

# Build and push model training Docker image
echo "Step 10/14: Building model training Docker image..."
if docker build -t $MODEL_IMAGE -f Dockerfile.model .; then
    echo "Step 10/14: Model training Docker image built successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 10/14: Failed to build model training Docker image."
    exit 1
fi

echo "Step 11/14: Pushing model training Docker image..."
if docker push $MODEL_IMAGE; then
    echo "Step 11/14: Model training Docker image pushed successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 11/14: Failed to push model training Docker image."
    exit 1
fi

# Delete existing Kubernetes deployments and services (moved here before applying new ones)
echo "Step 12/14: Deleting existing Kubernetes deployments and services..."
if kubectl delete -f $K8S_DIR --ignore-not-found; then
    echo "Step 12/14: Existing Kubernetes deployments and services deleted."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 12/14: Failed to delete existing Kubernetes deployments and services."
    exit 1
fi

# Apply new Kubernetes configurations
echo "Step 13/14: Applying new Kubernetes configurations..."
if kubectl apply -f $K8S_DIR; then
    echo "Step 13/14: Kubernetes configurations applied successfully."
    passed_steps=$((passed_steps + 1))
else
    echo "Step 13/14: Failed to apply Kubernetes configurations."
    exit 1
fi

# Watch Kubernetes pods to monitor the deployment
echo "Step 14/14: Monitoring Kubernetes pods..."
watch -n 1 kubectl get pods

# Summary
echo "Deployment completed successfully."
echo "$passed_steps out of $total_steps steps passed successfully."
