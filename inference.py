# Install dependencies

!pip install pip3-autoremove
!pip install torch torchvision torchaudio xformers --index-url https://download.pytorch.org/whl/cu128
!pip install unsloth
!pip install transformers==4.56.2
!pip install -q huggingface_hub

# Load model

from unsloth import FastLanguageModel
from transformers import TextStreamer
from huggingface_hub import login

login()

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name     = "username/modelname",
    max_seq_length = 2048,
    dtype          = None,
    load_in_4bit   = False
)

FastLanguageModel.for_inference(model)

# Inference

def chat(
    user_message: str,
    system_message: str | None = None,
    max_new_tokens: int = 128,
    temperature: float = 1.5,
    min_p: float = 0.1,
):
    """
    Streams a response from your fine-tuned model.
    Prints tokens to stdout as they are generated.
    """
    messages = []
    if system_message is not None:
        messages.append({"role": "system", "content": system_message})
    messages.append({"role": "user", "content": user_message})

    inputs = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,
        return_tensors="pt",
    ).to(model.device)

    streamer = TextStreamer(tokenizer, skip_prompt=True)

    _ = model.generate(
        input_ids      = inputs,
        streamer       = streamer,
        max_new_tokens = max_new_tokens,
        use_cache      = True,
        temperature    = temperature,
        min_p          = min_p,
    )

chat("Ask model a question")