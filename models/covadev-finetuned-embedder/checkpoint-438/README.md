---
tags:
- sentence-transformers
- sentence-similarity
- feature-extraction
- generated_from_trainer
- dataset_size:874
- loss:CosineSimilarityLoss
base_model: sentence-transformers/all-MiniLM-L6-v2
widget:
- source_sentence: Validates the completeness and accuracy of the customer's submitted
    order. Checks for any discrepancies or missing information in the order details.
  sentences:
  - Denies the request file by saving rejection reason and updating the final status.
  - Confirms whether a customer's payment has succeeded.
  - Audits supporting files for the repair ticket by checking completeness, validity,
    and required references.
- source_sentence: Checks availability for the selected room and requested date. Updates
    the housekeeping request with available options and availability status.
  sentences:
  - Scans availability for the room and returns matching options for the housekeeping
    request.
  - Settles car rental payment by recording amount, method, reference, and paid status.
  - Calculates supplier risk trend using rejected documents, late deliveries, and
    complaint history.
- source_sentence: Creates supplier account after onboarding approval. Stores supplier
    account number and activation status.
  sentences:
  - Scans the book availability window and returns matching options for the borrowing
    record.
  - Audits KYC documents by checking required files, expiration dates, and consistency
    with customer details.
  - Finalizes the supplier onboarding case after approval, account creation, and supplier
    notification.
- source_sentence: Calculates purchase cost using item prices, tax, shipping, and
    discounts. Stores estimated cost on the requisition case.
  sentences:
  - Checks campaign status and verifies that the requested donation amount is allowed.
  - Computes requisition cost by combining item totals, taxes, shipping fees, and
    discount values.
  - Verifies the customer record by checking required details and updating the repair
    ticket status.
- source_sentence: Collects permit payment for the approved parking request. Stores
    payment reference and marks the permit case as paid.
  sentences:
  - Determines return eligibility by comparing purchase date, request date, and allowed
    return period.
  - Allocates the task to a team member by saving owner, assignment time, and task
    status.
  - Settles parking permit payment by recording amount, method, reference, and paid
    status.
pipeline_tag: sentence-similarity
library_name: sentence-transformers
---

# SentenceTransformer based on sentence-transformers/all-MiniLM-L6-v2

This is a [sentence-transformers](https://www.SBERT.net) model finetuned from [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) on the csv dataset. It maps sentences & paragraphs to a 384-dimensional dense vector space and can be used for retrieval.

## Model Details

### Model Description
- **Model Type:** Sentence Transformer
- **Base model:** [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) <!-- at revision c9745ed1d9f207416be6d2e6f8de32d1f16199bf -->
- **Maximum Sequence Length:** 256 tokens
- **Output Dimensionality:** 384 dimensions
- **Similarity Function:** Cosine Similarity
- **Supported Modality:** Text
- **Training Dataset:**
    - csv
<!-- - **Language:** Unknown -->
<!-- - **License:** Unknown -->

### Model Sources

- **Documentation:** [Sentence Transformers Documentation](https://sbert.net)
- **Repository:** [Sentence Transformers on GitHub](https://github.com/huggingface/sentence-transformers)
- **Hugging Face:** [Sentence Transformers on Hugging Face](https://huggingface.co/models?library=sentence-transformers)

### Full Model Architecture

```
SentenceTransformer(
  (0): Transformer({'transformer_task': 'feature-extraction', 'modality_config': {'text': {'method': 'forward', 'method_output_name': 'last_hidden_state'}}, 'module_output_name': 'token_embeddings', 'architecture': 'BertModel'})
  (1): Pooling({'embedding_dimension': 384, 'pooling_mode': 'mean', 'include_prompt': True})
  (2): Normalize({})
)
```

## Usage

### Direct Usage (Sentence Transformers)

First install the Sentence Transformers library:

```bash
pip install -U sentence-transformers
```
Then you can load this model and run inference.
```python
from sentence_transformers import SentenceTransformer

# Download from the 🤗 Hub
model = SentenceTransformer("sentence_transformers_model_id")
# Run inference
sentences = [
    'Collects permit payment for the approved parking request. Stores payment reference and marks the permit case as paid.',
    'Settles parking permit payment by recording amount, method, reference, and paid status.',
    'Determines return eligibility by comparing purchase date, request date, and allowed return period.',
]
embeddings = model.encode(sentences)
print(embeddings.shape)
# [3, 384]

# Get the similarity scores for the embeddings
similarities = model.similarity(embeddings, embeddings)
print(similarities)
# tensor([[1.0000, 0.9807, 0.0098],
#         [0.9807, 1.0000, 0.0314],
#         [0.0098, 0.0314, 1.0000]])
```
<!--
### Direct Usage (Transformers)

<details><summary>Click to see the direct usage in Transformers</summary>

</details>
-->

<!--
### Downstream Usage (Sentence Transformers)

You can finetune this model on your own dataset.

<details><summary>Click to expand</summary>

</details>
-->

<!--
### Out-of-Scope Use

*List how the model may foreseeably be misused and address what users ought not to do with the model.*
-->

<!--
## Bias, Risks and Limitations

*What are the known or foreseeable issues stemming from this model? You could also flag here known failure cases or weaknesses of the model.*
-->

<!--
### Recommendations

*What are recommendations with respect to the foreseeable issues? For example, filtering explicit content.*
-->

## Training Details

### Training Dataset

#### csv

* Dataset: csv
* Size: 874 training samples
* Columns: <code>sentence1</code>, <code>sentence2</code>, and <code>score</code>
* Approximate statistics based on the first 874 samples:
  |         | sentence1                                                                          | sentence2                                                                          | score                                                          |
  |:--------|:-----------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------|:---------------------------------------------------------------|
  | type    | string                                                                             | string                                                                             | float                                                          |
  | details | <ul><li>min: 13 tokens</li><li>mean: 23.34 tokens</li><li>max: 40 tokens</li></ul> | <ul><li>min: 12 tokens</li><li>mean: 19.98 tokens</li><li>max: 44 tokens</li></ul> | <ul><li>min: 0.0</li><li>mean: 0.55</li><li>max: 1.0</li></ul> |
* Samples:
  | sentence1                                                                                                                                                         | sentence2                                                                                           | score            |
  |:------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------|:-----------------|
  | <code>Validates the completeness and accuracy of the customer's submitted order. Checks for any discrepancies or missing information in the order details.</code> | <code>Confirms whether an order is valid by checking required customer data and order items.</code> | <code>1.0</code> |
  | <code>Sends a confirmation email to the recipient about the order status. Updates the order status to reflect the confirmation email has been sent.</code>        | <code>Sends a confirmation email to the customer after an order is completed.</code>                | <code>1.0</code> |
  | <code>Searches for valid payment methods to confirm order payment. Updates inventory levels based on the confirmed order payment status.</code>                   | <code>Confirms whether a customer's payment has succeeded.</code>                                   | <code>1.0</code> |
* Loss: [<code>CosineSimilarityLoss</code>](https://sbert.net/docs/package_reference/sentence_transformer/losses.html#cosinesimilarityloss) with these parameters:
  ```json
  {
      "loss_fct": "torch.nn.modules.loss.MSELoss",
      "cos_score_transformation": "torch.nn.modules.linear.Identity"
  }
  ```

### Training Hyperparameters
#### Non-Default Hyperparameters

- `per_device_train_batch_size`: 4
- `learning_rate`: 2e-05
- `num_train_epochs`: 5
- `warmup_steps`: 0.1

#### All Hyperparameters
<details><summary>Click to expand</summary>

- `do_predict`: False
- `prediction_loss_only`: True
- `per_device_train_batch_size`: 4
- `per_device_eval_batch_size`: 8
- `gradient_accumulation_steps`: 1
- `eval_accumulation_steps`: None
- `torch_empty_cache_steps`: None
- `learning_rate`: 2e-05
- `weight_decay`: 0.0
- `adam_beta1`: 0.9
- `adam_beta2`: 0.999
- `adam_epsilon`: 1e-08
- `max_grad_norm`: 1.0
- `num_train_epochs`: 5
- `max_steps`: -1
- `lr_scheduler_type`: linear
- `lr_scheduler_kwargs`: None
- `warmup_ratio`: None
- `warmup_steps`: 0.1
- `log_level`: passive
- `log_level_replica`: warning
- `log_on_each_node`: True
- `logging_nan_inf_filter`: True
- `enable_jit_checkpoint`: False
- `save_on_each_node`: False
- `save_only_model`: False
- `restore_callback_states_from_checkpoint`: False
- `use_cpu`: False
- `seed`: 42
- `data_seed`: None
- `bf16`: False
- `fp16`: False
- `bf16_full_eval`: False
- `fp16_full_eval`: False
- `tf32`: None
- `local_rank`: -1
- `ddp_backend`: None
- `debug`: []
- `dataloader_drop_last`: False
- `dataloader_num_workers`: 0
- `dataloader_prefetch_factor`: None
- `disable_tqdm`: False
- `remove_unused_columns`: True
- `label_names`: None
- `load_best_model_at_end`: False
- `ignore_data_skip`: False
- `fsdp`: []
- `fsdp_config`: {'min_num_params': 0, 'xla': False, 'xla_fsdp_v2': False, 'xla_fsdp_grad_ckpt': False}
- `accelerator_config`: {'split_batches': False, 'dispatch_batches': None, 'even_batches': True, 'use_seedable_sampler': True, 'non_blocking': False, 'gradient_accumulation_kwargs': None}
- `parallelism_config`: None
- `deepspeed`: None
- `label_smoothing_factor`: 0.0
- `optim`: adamw_torch_fused
- `optim_args`: None
- `group_by_length`: False
- `length_column_name`: length
- `project`: huggingface
- `trackio_space_id`: trackio
- `ddp_find_unused_parameters`: None
- `ddp_bucket_cap_mb`: None
- `ddp_broadcast_buffers`: False
- `dataloader_pin_memory`: True
- `dataloader_persistent_workers`: False
- `skip_memory_metrics`: True
- `push_to_hub`: False
- `resume_from_checkpoint`: None
- `hub_model_id`: None
- `hub_strategy`: every_save
- `hub_private_repo`: None
- `hub_always_push`: False
- `hub_revision`: None
- `gradient_checkpointing`: False
- `gradient_checkpointing_kwargs`: None
- `include_for_metrics`: []
- `eval_do_concat_batches`: True
- `auto_find_batch_size`: False
- `full_determinism`: False
- `ddp_timeout`: 1800
- `torch_compile`: False
- `torch_compile_backend`: None
- `torch_compile_mode`: None
- `include_num_input_tokens_seen`: no
- `neftune_noise_alpha`: None
- `optim_target_modules`: None
- `batch_eval_metrics`: False
- `eval_on_start`: False
- `use_liger_kernel`: False
- `liger_kernel_config`: None
- `eval_use_gather_object`: False
- `average_tokens_across_devices`: True
- `use_cache`: False
- `prompts`: None
- `batch_sampler`: batch_sampler
- `multi_dataset_batch_sampler`: proportional
- `router_mapping`: {}
- `learning_rate_mapping`: {}

</details>

### Training Logs
<details><summary>Click to expand</summary>

| Epoch  | Step | Training Loss |
|:------:|:----:|:-------------:|
| 0.0046 | 1    | 0.0910        |
| 0.0091 | 2    | 0.1987        |
| 0.0137 | 3    | 0.1369        |
| 0.0183 | 4    | 0.1394        |
| 0.0228 | 5    | 0.2600        |
| 0.0274 | 6    | 0.0576        |
| 0.0320 | 7    | 0.0863        |
| 0.0365 | 8    | 0.1224        |
| 0.0411 | 9    | 0.2107        |
| 0.0457 | 10   | 0.1517        |
| 0.0502 | 11   | 0.1483        |
| 0.0548 | 12   | 0.1684        |
| 0.0594 | 13   | 0.1004        |
| 0.0639 | 14   | 0.0724        |
| 0.0685 | 15   | 0.2262        |
| 0.0731 | 16   | 0.1873        |
| 0.0776 | 17   | 0.0922        |
| 0.0822 | 18   | 0.1444        |
| 0.0868 | 19   | 0.1340        |
| 0.0913 | 20   | 0.0916        |
| 0.0959 | 21   | 0.1497        |
| 0.1005 | 22   | 0.0822        |
| 0.1050 | 23   | 0.1519        |
| 0.1096 | 24   | 0.1053        |
| 0.1142 | 25   | 0.2885        |
| 0.1187 | 26   | 0.1794        |
| 0.1233 | 27   | 0.2625        |
| 0.1279 | 28   | 0.1835        |
| 0.1324 | 29   | 0.0621        |
| 0.1370 | 30   | 0.1587        |
| 0.1416 | 31   | 0.0911        |
| 0.1461 | 32   | 0.1912        |
| 0.1507 | 33   | 0.1526        |
| 0.1553 | 34   | 0.2403        |
| 0.1598 | 35   | 0.1316        |
| 0.1644 | 36   | 0.0823        |
| 0.1689 | 37   | 0.1399        |
| 0.1735 | 38   | 0.0881        |
| 0.1781 | 39   | 0.1570        |
| 0.1826 | 40   | 0.1012        |
| 0.1872 | 41   | 0.2252        |
| 0.1918 | 42   | 0.1681        |
| 0.1963 | 43   | 0.0972        |
| 0.2009 | 44   | 0.1463        |
| 0.2055 | 45   | 0.1015        |
| 0.2100 | 46   | 0.1054        |
| 0.2146 | 47   | 0.1513        |
| 0.2192 | 48   | 0.1575        |
| 0.2237 | 49   | 0.1335        |
| 0.2283 | 50   | 0.1485        |
| 0.2329 | 51   | 0.1853        |
| 0.2374 | 52   | 0.1911        |
| 0.2420 | 53   | 0.1132        |
| 0.2466 | 54   | 0.1745        |
| 0.2511 | 55   | 0.1270        |
| 0.2557 | 56   | 0.1318        |
| 0.2603 | 57   | 0.0774        |
| 0.2648 | 58   | 0.1372        |
| 0.2694 | 59   | 0.0670        |
| 0.2740 | 60   | 0.0742        |
| 0.2785 | 61   | 0.1248        |
| 0.2831 | 62   | 0.1478        |
| 0.2877 | 63   | 0.0996        |
| 0.2922 | 64   | 0.1776        |
| 0.2968 | 65   | 0.1838        |
| 0.3014 | 66   | 0.1276        |
| 0.3059 | 67   | 0.1070        |
| 0.3105 | 68   | 0.0721        |
| 0.3151 | 69   | 0.0567        |
| 0.3196 | 70   | 0.0790        |
| 0.3242 | 71   | 0.1033        |
| 0.3288 | 72   | 0.1308        |
| 0.3333 | 73   | 0.0687        |
| 0.3379 | 74   | 0.1143        |
| 0.3425 | 75   | 0.0325        |
| 0.3470 | 76   | 0.0635        |
| 0.3516 | 77   | 0.0841        |
| 0.3562 | 78   | 0.1358        |
| 0.3607 | 79   | 0.1555        |
| 0.3653 | 80   | 0.1266        |
| 0.3699 | 81   | 0.0540        |
| 0.3744 | 82   | 0.1148        |
| 0.3790 | 83   | 0.1523        |
| 0.3836 | 84   | 0.1026        |
| 0.3881 | 85   | 0.1019        |
| 0.3927 | 86   | 0.0546        |
| 0.3973 | 87   | 0.0619        |
| 0.4018 | 88   | 0.0558        |
| 0.4064 | 89   | 0.2578        |
| 0.4110 | 90   | 0.0443        |
| 0.4155 | 91   | 0.0853        |
| 0.4201 | 92   | 0.0708        |
| 0.4247 | 93   | 0.1055        |
| 0.4292 | 94   | 0.0467        |
| 0.4338 | 95   | 0.0916        |
| 0.4384 | 96   | 0.0719        |
| 0.4429 | 97   | 0.1261        |
| 0.4475 | 98   | 0.1073        |
| 0.4521 | 99   | 0.0583        |
| 0.4566 | 100  | 0.0662        |
| 0.4612 | 101  | 0.0916        |
| 0.4658 | 102  | 0.1154        |
| 0.4703 | 103  | 0.0768        |
| 0.4749 | 104  | 0.0506        |
| 0.4795 | 105  | 0.0538        |
| 0.4840 | 106  | 0.0775        |
| 0.4886 | 107  | 0.0489        |
| 0.4932 | 108  | 0.0441        |
| 0.4977 | 109  | 0.0965        |
| 0.5023 | 110  | 0.0693        |
| 0.5068 | 111  | 0.0941        |
| 0.5114 | 112  | 0.0502        |
| 0.5160 | 113  | 0.1372        |
| 0.5205 | 114  | 0.0369        |
| 0.5251 | 115  | 0.0964        |
| 0.5297 | 116  | 0.0818        |
| 0.5342 | 117  | 0.2063        |
| 0.5388 | 118  | 0.0596        |
| 0.5434 | 119  | 0.0969        |
| 0.5479 | 120  | 0.0616        |
| 0.5525 | 121  | 0.0545        |
| 0.5571 | 122  | 0.0507        |
| 0.5616 | 123  | 0.0769        |
| 0.5662 | 124  | 0.1862        |
| 0.5708 | 125  | 0.0829        |
| 0.5753 | 126  | 0.0500        |
| 0.5799 | 127  | 0.0327        |
| 0.5845 | 128  | 0.1086        |
| 0.5890 | 129  | 0.0404        |
| 0.5936 | 130  | 0.1077        |
| 0.5982 | 131  | 0.0941        |
| 0.6027 | 132  | 0.0639        |
| 0.6073 | 133  | 0.0814        |
| 0.6119 | 134  | 0.0857        |
| 0.6164 | 135  | 0.0402        |
| 0.6210 | 136  | 0.0833        |
| 0.6256 | 137  | 0.1014        |
| 0.6301 | 138  | 0.0820        |
| 0.6347 | 139  | 0.0785        |
| 0.6393 | 140  | 0.0600        |
| 0.6438 | 141  | 0.0572        |
| 0.6484 | 142  | 0.0498        |
| 0.6530 | 143  | 0.0546        |
| 0.6575 | 144  | 0.0854        |
| 0.6621 | 145  | 0.0156        |
| 0.6667 | 146  | 0.0867        |
| 0.6712 | 147  | 0.1444        |
| 0.6758 | 148  | 0.1441        |
| 0.6804 | 149  | 0.0403        |
| 0.6849 | 150  | 0.0415        |
| 0.6895 | 151  | 0.0648        |
| 0.6941 | 152  | 0.0432        |
| 0.6986 | 153  | 0.0163        |
| 0.7032 | 154  | 0.0400        |
| 0.7078 | 155  | 0.0695        |
| 0.7123 | 156  | 0.1037        |
| 0.7169 | 157  | 0.0920        |
| 0.7215 | 158  | 0.0538        |
| 0.7260 | 159  | 0.1713        |
| 0.7306 | 160  | 0.0407        |
| 0.7352 | 161  | 0.0971        |
| 0.7397 | 162  | 0.0881        |
| 0.7443 | 163  | 0.0724        |
| 0.7489 | 164  | 0.0745        |
| 0.7534 | 165  | 0.0530        |
| 0.7580 | 166  | 0.0602        |
| 0.7626 | 167  | 0.0322        |
| 0.7671 | 168  | 0.0526        |
| 0.7717 | 169  | 0.0675        |
| 0.7763 | 170  | 0.0353        |
| 0.7808 | 171  | 0.0294        |
| 0.7854 | 172  | 0.0551        |
| 0.7900 | 173  | 0.0675        |
| 0.7945 | 174  | 0.0099        |
| 0.7991 | 175  | 0.0108        |
| 0.8037 | 176  | 0.0419        |
| 0.8082 | 177  | 0.0885        |
| 0.8128 | 178  | 0.0900        |
| 0.8174 | 179  | 0.0587        |
| 0.8219 | 180  | 0.0698        |
| 0.8265 | 181  | 0.0347        |
| 0.8311 | 182  | 0.0206        |
| 0.8356 | 183  | 0.0286        |
| 0.8402 | 184  | 0.0167        |
| 0.8447 | 185  | 0.0525        |
| 0.8493 | 186  | 0.0256        |
| 0.8539 | 187  | 0.0925        |
| 0.8584 | 188  | 0.1048        |
| 0.8630 | 189  | 0.0696        |
| 0.8676 | 190  | 0.0749        |
| 0.8721 | 191  | 0.0706        |
| 0.8767 | 192  | 0.1576        |
| 0.8813 | 193  | 0.0329        |
| 0.8858 | 194  | 0.0460        |
| 0.8904 | 195  | 0.0708        |
| 0.8950 | 196  | 0.0497        |
| 0.8995 | 197  | 0.0205        |
| 0.9041 | 198  | 0.0208        |
| 0.9087 | 199  | 0.1268        |
| 0.9132 | 200  | 0.0329        |
| 0.9178 | 201  | 0.0854        |
| 0.9224 | 202  | 0.0335        |
| 0.9269 | 203  | 0.0327        |
| 0.9315 | 204  | 0.0413        |
| 0.9361 | 205  | 0.0646        |
| 0.9406 | 206  | 0.1172        |
| 0.9452 | 207  | 0.1003        |
| 0.9498 | 208  | 0.0565        |
| 0.9543 | 209  | 0.0983        |
| 0.9589 | 210  | 0.0409        |
| 0.9635 | 211  | 0.0153        |
| 0.9680 | 212  | 0.0830        |
| 0.9726 | 213  | 0.0340        |
| 0.9772 | 214  | 0.0410        |
| 0.9817 | 215  | 0.0302        |
| 0.9863 | 216  | 0.0464        |
| 0.9909 | 217  | 0.0550        |
| 0.9954 | 218  | 0.0675        |
| 1.0    | 219  | 0.0044        |
| 1.0046 | 220  | 0.0100        |
| 1.0091 | 221  | 0.0521        |
| 1.0137 | 222  | 0.0069        |
| 1.0183 | 223  | 0.0138        |
| 1.0228 | 224  | 0.0612        |
| 1.0274 | 225  | 0.0063        |
| 1.0320 | 226  | 0.0270        |
| 1.0365 | 227  | 0.0802        |
| 1.0411 | 228  | 0.0236        |
| 1.0457 | 229  | 0.0130        |
| 1.0502 | 230  | 0.0075        |
| 1.0548 | 231  | 0.0231        |
| 1.0594 | 232  | 0.0363        |
| 1.0639 | 233  | 0.0074        |
| 1.0685 | 234  | 0.0395        |
| 1.0731 | 235  | 0.0382        |
| 1.0776 | 236  | 0.0136        |
| 1.0822 | 237  | 0.0092        |
| 1.0868 | 238  | 0.0197        |
| 1.0913 | 239  | 0.0408        |
| 1.0959 | 240  | 0.0328        |
| 1.1005 | 241  | 0.0451        |
| 1.1050 | 242  | 0.0630        |
| 1.1096 | 243  | 0.0295        |
| 1.1142 | 244  | 0.0186        |
| 1.1187 | 245  | 0.0227        |
| 1.1233 | 246  | 0.0272        |
| 1.1279 | 247  | 0.0396        |
| 1.1324 | 248  | 0.0485        |
| 1.1370 | 249  | 0.0405        |
| 1.1416 | 250  | 0.0460        |
| 1.1461 | 251  | 0.0192        |
| 1.1507 | 252  | 0.0404        |
| 1.1553 | 253  | 0.0146        |
| 1.1598 | 254  | 0.0073        |
| 1.1644 | 255  | 0.0260        |
| 1.1689 | 256  | 0.0401        |
| 1.1735 | 257  | 0.0190        |
| 1.1781 | 258  | 0.0396        |
| 1.1826 | 259  | 0.0223        |
| 1.1872 | 260  | 0.0124        |
| 1.1918 | 261  | 0.0234        |
| 1.1963 | 262  | 0.0947        |
| 1.2009 | 263  | 0.1080        |
| 1.2055 | 264  | 0.0236        |
| 1.2100 | 265  | 0.0184        |
| 1.2146 | 266  | 0.0286        |
| 1.2192 | 267  | 0.0179        |
| 1.2237 | 268  | 0.0470        |
| 1.2283 | 269  | 0.0310        |
| 1.2329 | 270  | 0.0926        |
| 1.2374 | 271  | 0.0105        |
| 1.2420 | 272  | 0.0203        |
| 1.2466 | 273  | 0.0278        |
| 1.2511 | 274  | 0.0657        |
| 1.2557 | 275  | 0.1501        |
| 1.2603 | 276  | 0.0165        |
| 1.2648 | 277  | 0.0260        |
| 1.2694 | 278  | 0.0203        |
| 1.2740 | 279  | 0.0322        |
| 1.2785 | 280  | 0.0587        |
| 1.2831 | 281  | 0.0177        |
| 1.2877 | 282  | 0.0180        |
| 1.2922 | 283  | 0.0231        |
| 1.2968 | 284  | 0.0135        |
| 1.3014 | 285  | 0.2038        |
| 1.3059 | 286  | 0.0999        |
| 1.3105 | 287  | 0.0320        |
| 1.3151 | 288  | 0.0076        |
| 1.3196 | 289  | 0.0594        |
| 1.3242 | 290  | 0.0204        |
| 1.3288 | 291  | 0.0119        |
| 1.3333 | 292  | 0.0167        |
| 1.3379 | 293  | 0.0288        |
| 1.3425 | 294  | 0.0282        |
| 1.3470 | 295  | 0.0695        |
| 1.3516 | 296  | 0.0233        |
| 1.3562 | 297  | 0.0326        |
| 1.3607 | 298  | 0.1015        |
| 1.3653 | 299  | 0.0386        |
| 1.3699 | 300  | 0.0057        |
| 1.3744 | 301  | 0.0849        |
| 1.3790 | 302  | 0.0206        |
| 1.3836 | 303  | 0.0813        |
| 1.3881 | 304  | 0.0168        |
| 1.3927 | 305  | 0.0307        |
| 1.3973 | 306  | 0.0161        |
| 1.4018 | 307  | 0.0918        |
| 1.4064 | 308  | 0.0279        |
| 1.4110 | 309  | 0.0329        |
| 1.4155 | 310  | 0.0246        |
| 1.4201 | 311  | 0.0237        |
| 1.4247 | 312  | 0.0065        |
| 1.4292 | 313  | 0.0298        |
| 1.4338 | 314  | 0.0099        |
| 1.4384 | 315  | 0.0352        |
| 1.4429 | 316  | 0.0176        |
| 1.4475 | 317  | 0.0189        |
| 1.4521 | 318  | 0.0230        |
| 1.4566 | 319  | 0.0571        |
| 1.4612 | 320  | 0.0297        |
| 1.4658 | 321  | 0.0345        |
| 1.4703 | 322  | 0.0316        |
| 1.4749 | 323  | 0.0138        |
| 1.4795 | 324  | 0.0387        |
| 1.4840 | 325  | 0.0599        |
| 1.4886 | 326  | 0.0167        |
| 1.4932 | 327  | 0.0951        |
| 1.4977 | 328  | 0.0245        |
| 1.5023 | 329  | 0.0123        |
| 1.5068 | 330  | 0.0214        |
| 1.5114 | 331  | 0.0058        |
| 1.5160 | 332  | 0.0279        |
| 1.5205 | 333  | 0.0095        |
| 1.5251 | 334  | 0.0340        |
| 1.5297 | 335  | 0.0026        |
| 1.5342 | 336  | 0.0087        |
| 1.5388 | 337  | 0.0194        |
| 1.5434 | 338  | 0.0149        |
| 1.5479 | 339  | 0.0847        |
| 1.5525 | 340  | 0.0340        |
| 1.5571 | 341  | 0.0149        |
| 1.5616 | 342  | 0.0347        |
| 1.5662 | 343  | 0.0151        |
| 1.5708 | 344  | 0.0233        |
| 1.5753 | 345  | 0.0228        |
| 1.5799 | 346  | 0.0097        |
| 1.5845 | 347  | 0.0191        |
| 1.5890 | 348  | 0.0414        |
| 1.5936 | 349  | 0.0704        |
| 1.5982 | 350  | 0.0359        |
| 1.6027 | 351  | 0.0122        |
| 1.6073 | 352  | 0.0139        |
| 1.6119 | 353  | 0.0491        |
| 1.6164 | 354  | 0.0386        |
| 1.6210 | 355  | 0.0202        |
| 1.6256 | 356  | 0.0482        |
| 1.6301 | 357  | 0.0192        |
| 1.6347 | 358  | 0.0641        |
| 1.6393 | 359  | 0.1681        |
| 1.6438 | 360  | 0.0321        |
| 1.6484 | 361  | 0.0176        |
| 1.6530 | 362  | 0.0279        |
| 1.6575 | 363  | 0.0070        |
| 1.6621 | 364  | 0.0105        |
| 1.6667 | 365  | 0.0193        |
| 1.6712 | 366  | 0.0036        |
| 1.6758 | 367  | 0.0044        |
| 1.6804 | 368  | 0.0205        |
| 1.6849 | 369  | 0.0767        |
| 1.6895 | 370  | 0.0088        |
| 1.6941 | 371  | 0.0175        |
| 1.6986 | 372  | 0.0417        |
| 1.7032 | 373  | 0.1177        |
| 1.7078 | 374  | 0.1201        |
| 1.7123 | 375  | 0.0110        |
| 1.7169 | 376  | 0.0554        |
| 1.7215 | 377  | 0.0122        |
| 1.7260 | 378  | 0.0212        |
| 1.7306 | 379  | 0.0238        |
| 1.7352 | 380  | 0.0096        |
| 1.7397 | 381  | 0.0637        |
| 1.7443 | 382  | 0.0289        |
| 1.7489 | 383  | 0.0718        |
| 1.7534 | 384  | 0.0180        |
| 1.7580 | 385  | 0.0114        |
| 1.7626 | 386  | 0.0207        |
| 1.7671 | 387  | 0.0036        |
| 1.7717 | 388  | 0.0205        |
| 1.7763 | 389  | 0.1212        |
| 1.7808 | 390  | 0.0342        |
| 1.7854 | 391  | 0.0385        |
| 1.7900 | 392  | 0.0120        |
| 1.7945 | 393  | 0.0056        |
| 1.7991 | 394  | 0.0861        |
| 1.8037 | 395  | 0.0093        |
| 1.8082 | 396  | 0.0148        |
| 1.8128 | 397  | 0.0695        |
| 1.8174 | 398  | 0.0135        |
| 1.8219 | 399  | 0.0246        |
| 1.8265 | 400  | 0.0104        |
| 1.8311 | 401  | 0.0193        |
| 1.8356 | 402  | 0.0235        |
| 1.8402 | 403  | 0.0494        |
| 1.8447 | 404  | 0.0140        |
| 1.8493 | 405  | 0.0711        |
| 1.8539 | 406  | 0.0204        |
| 1.8584 | 407  | 0.0169        |
| 1.8630 | 408  | 0.0301        |
| 1.8676 | 409  | 0.0154        |
| 1.8721 | 410  | 0.0728        |
| 1.8767 | 411  | 0.0336        |
| 1.8813 | 412  | 0.1375        |
| 1.8858 | 413  | 0.0198        |
| 1.8904 | 414  | 0.2161        |
| 1.8950 | 415  | 0.0163        |
| 1.8995 | 416  | 0.0063        |
| 1.9041 | 417  | 0.0345        |
| 1.9087 | 418  | 0.0261        |
| 1.9132 | 419  | 0.0132        |
| 1.9178 | 420  | 0.0678        |
| 1.9224 | 421  | 0.0214        |
| 1.9269 | 422  | 0.0085        |
| 1.9315 | 423  | 0.0018        |
| 1.9361 | 424  | 0.0135        |
| 1.9406 | 425  | 0.0272        |
| 1.9452 | 426  | 0.0145        |
| 1.9498 | 427  | 0.0101        |
| 1.9543 | 428  | 0.0529        |
| 1.9589 | 429  | 0.1360        |
| 1.9635 | 430  | 0.0047        |
| 1.9680 | 431  | 0.0351        |
| 1.9726 | 432  | 0.0349        |
| 1.9772 | 433  | 0.0094        |
| 1.9817 | 434  | 0.0404        |
| 1.9863 | 435  | 0.0041        |
| 1.9909 | 436  | 0.0795        |
| 1.9954 | 437  | 0.0090        |
| 2.0    | 438  | 0.0011        |

</details>

### Training Time
- **Training**: 1.3 minutes

### Framework Versions
- Python: 3.14.0
- Sentence Transformers: 5.4.1
- Transformers: 5.1.0
- PyTorch: 2.10.0+cpu
- Accelerate: 1.13.0
- Datasets: 4.8.5
- Tokenizers: 0.22.2

## Citation

### BibTeX

#### Sentence Transformers
```bibtex
@inproceedings{reimers-2019-sentence-bert,
    title = "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks",
    author = "Reimers, Nils and Gurevych, Iryna",
    booktitle = "Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing",
    month = "11",
    year = "2019",
    publisher = "Association for Computational Linguistics",
    url = "https://arxiv.org/abs/1908.10084",
}
```

<!--
## Glossary

*Clearly define terms in order to be accessible across audiences.*
-->

<!--
## Model Card Authors

*Lists the people who create the model card, providing recognition and accountability for the detailed work that goes into its construction.*
-->

<!--
## Model Card Contact

*Provides a way for people who have updates to the Model Card, suggestions, or questions, to contact the Model Card authors.*
-->