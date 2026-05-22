from datasets import load_dataset
from sentence_transformers import SentenceTransformer
from sentence_transformers.losses import CosineSimilarityLoss
from sentence_transformers import SentenceTransformerTrainer, SentenceTransformerTrainingArguments

BASE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
OUTPUT_MODEL = "models/covadev-finetuned-embedder"

dataset = load_dataset(
    "csv",
    data_files="training/training_data.csv"
)["train"]

model = SentenceTransformer(BASE_MODEL)

loss = CosineSimilarityLoss(model)

args = SentenceTransformerTrainingArguments(
    output_dir=OUTPUT_MODEL,
    num_train_epochs=5,
    per_device_train_batch_size=4,
    learning_rate=2e-5,
    warmup_ratio=0.1,
    logging_steps=1,
    save_strategy="epoch",
)

trainer = SentenceTransformerTrainer(
    model=model,
    args=args,
    train_dataset=dataset,
    loss=loss,
)

trainer.train()

model.save(OUTPUT_MODEL)

print("Fine-tuned model saved to:", OUTPUT_MODEL)