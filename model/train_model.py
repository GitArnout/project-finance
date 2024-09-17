import logging
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification, Trainer, TrainingArguments
import torch
from torch.nn import functional as F
from datasets import Dataset
from sklearn.model_selection import train_test_split
import pandas as pd

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def train_model_on_data(data):
    logging.info("Preparing the data for training...")

    # Convert data to a DataFrame-like structure
    df = pd.DataFrame(data, columns=['transaction_id', 'label_name'])

    # Label encoding
    label_mapping = {label: idx for idx, label in enumerate(df['label_name'].unique())}
    df['label'] = df['label_name'].map(label_mapping)

    # Split the data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(df[['transaction_id']], df['label'], test_size=0.2, random_state=42)

    # Create Dataset objects
    train_dataset = Dataset.from_dict({'text': X_train['transaction_id'].astype(str).tolist(), 'label': y_train.tolist()})
    test_dataset = Dataset.from_dict({'text': X_test['transaction_id'].astype(str).tolist(), 'label': y_test.tolist()})

    # Load tokenizer and model
    tokenizer = DistilBertTokenizerFast.from_pretrained('distilbert-base-uncased')
    model = DistilBertForSequenceClassification.from_pretrained('distilbert-base-uncased', num_labels=len(label_mapping)).to(device)

    # Tokenize the data
    def tokenize_function(examples):
        return tokenizer(examples['text'], padding='max_length', truncation=True, clean_up_tokenization_spaces=False)

    train_tokenized = train_dataset.map(tokenize_function, batched=True)
    test_tokenized = test_dataset.map(tokenize_function, batched=True)

    # Define training arguments
    training_args = TrainingArguments(
        output_dir='./results',
        eval_strategy='epoch',  # Updated to eval_strategy
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
    logging.info("Starting model training...")
    trainer.train()
    logging.info("Training complete.")

    # Evaluate the model
    logging.info("Evaluating the model...")
    results = trainer.evaluate()
    logging.info(f"Evaluation results: {results}")

    # Save the model
    model.save_pretrained('./distilbert_model')
    tokenizer.save_pretrained('./distilbert_model')

    return model, results

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Dummy data to simulate the training input
    data = [
        {"transaction_id": "T12345", "label_name": "Category1"},
        {"transaction_id": "T67890", "label_name": "Category2"},
        {"transaction_id": "T24680", "label_name": "Category3"},
        {"transaction_id": "T13579", "label_name": "Category1"},
        {"transaction_id": "T11121", "label_name": "Category2"},
    ]

    # Train the model on this data
    train_model_on_data(data)
