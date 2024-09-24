import os
import pandas as pd
import logging
import torch
from sklearn.model_selection import train_test_split
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification, Trainer, TrainingArguments
from datasets import Dataset
from random import sample
import torch.nn.functional as F
import requests  # Add requests to fetch data from the API

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check if a GPU is available
device = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')
logger.info(f"Using device: {device}")

def fetch_data():
    # Fetch data from the API URL
    url = 'http://172.21.127.147:30000/api/transactions?month=august%202024'
    try:
        response = requests.get(url)
        response.raise_for_status()
        transactions = response.json()  # Get the JSON response from the API
        logger.info(f"Fetched {len(transactions)} transactions from the API.")
        
        # Convert the JSON data to a pandas DataFrame
        data = pd.DataFrame(transactions)
        return data
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch data from the API: {e}")
        return pd.DataFrame()  # Return an empty DataFrame in case of failure

def train_model_on_data(data):
    logger.info("Preparing the data for training...")

    # Prepare the data
    labeled_data = data.dropna(subset=['label'])
    label_mapping = {label: idx for idx, label in enumerate(labeled_data['label'].unique())}
    labeled_data.loc[:, 'label'] = labeled_data['label_name'].map(label_mapping)


    # Split the data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(labeled_data[['company']], labeled_data['label'], test_size=0.2, random_state=42)

    # Create Dataset objects
    train_dataset = Dataset.from_dict({'text': X_train['company'].tolist(), 'label': y_train.tolist()})
    test_dataset = Dataset.from_dict({'text': X_test['company'].tolist(), 'label': y_test.tolist()})

    # Load tokenizer and model
    tokenizer = DistilBertTokenizerFast.from_pretrained('distilbert-base-uncased')
    model = DistilBertForSequenceClassification.from_pretrained('distilbert-base-uncased', num_labels=len(label_mapping)).to(device)

    # Tokenize the data
    def tokenize_function(examples):
        return tokenizer(examples['text'], padding='max_length', truncation=True)

    train_tokenized = train_dataset.map(tokenize_function, batched=True)
    test_tokenized = test_dataset.map(tokenize_function, batched=True)

    # Define training arguments
    training_args = TrainingArguments(
        output_dir='./results',
        eval_strategy='epoch',  # updated to avoid future deprecation
        learning_rate=2e-5,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        num_train_epochs=3,
        weight_decay=0.01,
    )


    # Create Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_tokenized,
        eval_dataset=test_tokenized,
    )

    # Train the model
    logger.info("Starting model training...")
    trainer.train()
    logger.info("Training complete.")

    # Save the model
    model.save_pretrained('./distilbert_model')
    tokenizer.save_pretrained('./distilbert_model')

    # Evaluate the model
    logger.info("Evaluating the model...")
    results = trainer.evaluate()
    logger.info(f"Evaluation results: {results}")

    # Log label distribution
    label_distribution = labeled_data['label'].value_counts()
    logger.info(f"Label distribution:\n{label_distribution}")

    return model, tokenizer, label_mapping

def predict_labels(model, tokenizer, label_mapping, data):
    # Predict labels for random unlabeled transactions
    unlabeled_data = data[data['label'].isna()]
    if len(unlabeled_data) > 10:
        random_transactions = sample(unlabeled_data.to_dict('records'), 10)
    else:
        random_transactions = unlabeled_data.to_dict('records')

    logger.info(f"Found {len(unlabeled_data)} transactions without labels.")
    for transaction in random_transactions:
        inputs = tokenizer(transaction['company'], return_tensors="pt", padding=True, truncation=True).to(device)
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = F.softmax(logits, dim=1)
        predicted_label_idx = torch.argmax(logits, dim=1).item()
        score = probabilities[0][predicted_label_idx].item()  # Get the probability of the predicted label
        label_name = list(label_mapping.keys())[predicted_label_idx]

        logger.info(f"Transaction ID: {transaction['id']}, Company: {transaction['company']}, Predicted Label: {label_name}, Score: {score:.4f}")

    # Specifically predict labels for "Albert Heijn"
    albert_heijn_transactions = unlabeled_data[unlabeled_data['company'].str.contains("Albert Heijn", case=False, na=False)]
    for _, transaction in albert_heijn_transactions.iterrows():
        inputs = tokenizer(transaction['company'], return_tensors="pt", padding=True, truncation=True).to(device)
        outputs = model(**inputs)
        logits = outputs.logits
        probabilities = F.softmax(logits, dim=1)
        predicted_label_idx = torch.argmax(logits, dim=1).item()
        score = probabilities[0][predicted_label_idx].item()
        label_name = list(label_mapping.keys())[predicted_label_idx]

        logger.info(f"ALBERT HEIJN Transaction ID: {transaction['id']}, Company: {transaction['company']}, Predicted Label: {label_name}, Score: {score:.4f}")

if __name__ == "__main__":
    # Fetch data from the API
    data = fetch_data()

    # Train model on the fetched data
    if not data.empty:
        model, tokenizer, label_mapping = train_model_on_data(data)

        # Predict labels on unlabeled data
        predict_labels(model, tokenizer, label_mapping, data)
    else:
        logger.error("No data available for training.")
