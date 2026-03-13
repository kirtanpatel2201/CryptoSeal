from flask import Flask, render_template, request
import hashlib
import json
import os
import secrets

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.fernet import Fernet

app = Flask(__name__)

# ---------------- VAULT CONFIG ----------------

VAULT_FILE = "vault.enc"

# fixed encryption key so vault can always decrypt
FERNET_KEY = b'6pXv9mN6j2lQXxPq9uG3oW2tV6k7aJ5Lr8ZcY1dE4Fg='
cipher = Fernet(FERNET_KEY)


# -------- HASH FILE --------

def get_hash(file):

    sha = hashlib.sha256()

    for chunk in iter(lambda: file.read(4096), b""):
        sha.update(chunk)

    file.seek(0)

    return sha.hexdigest()


# -------- LOAD VAULT (DECRYPT) --------

def load_vault():

    if not os.path.exists(VAULT_FILE):
        return {}

    with open(VAULT_FILE, "rb") as f:
        encrypted_data = f.read()

    try:
        decrypted = cipher.decrypt(encrypted_data)
        return json.loads(decrypted.decode())
    except:
        return {}


# -------- SAVE VAULT (ENCRYPT) --------

def save_vault(data):

    json_data = json.dumps(data).encode()

    encrypted = cipher.encrypt(json_data)

    with open(VAULT_FILE, "wb") as f:
        f.write(encrypted)


# -------- SIGN DOCUMENT --------

def sign_document(file):

    file_hash = get_hash(file)

    vault = load_vault()

    # If already signed → return existing key
    if file_hash in vault:
        return vault[file_hash]["key_id"]

    # Generate RSA key pair
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048
    )

    public_key = private_key.public_key()

    signature = private_key.sign(
        file_hash.encode(),
        padding.PKCS1v15(),
        hashes.SHA256()
    )

    public_key_pem = public_key.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()

    key_id = secrets.token_hex(16)  # 32 character key

    vault[file_hash] = {
        "key_id": key_id,
        "public_key": public_key_pem,
        "signature": signature.hex()
    }

    save_vault(vault)

    return key_id


# -------- VERIFY DOCUMENT --------

def verify_document(file, key_id):

    file_hash = get_hash(file)

    vault = load_vault()

    if file_hash not in vault:
        return False

    record = vault[file_hash]

    if record["key_id"] != key_id:
        return False

    public_key = serialization.load_pem_public_key(
        record["public_key"].encode()
    )

    signature = bytes.fromhex(record["signature"])

    try:

        public_key.verify(
            signature,
            file_hash.encode(),
            padding.PKCS1v15(),
            hashes.SHA256()
        )

        return True

    except:
        return False


# -------- ROUTES --------

@app.route("/")
def home():
    return render_template("index.html", active="sign")


@app.route("/sign", methods=["POST"])
def sign():

    file = request.files["file"]

    key_id = sign_document(file)

    return render_template(
        "index.html",
        message="Document Signed Successfully",
        key_id=key_id,
        active="sign"
    )


@app.route("/verify", methods=["POST"])
def verify():

    file = request.files["file"]
    key_id = request.form["key_id"]

    result = verify_document(file, key_id)

    if result:
        message = "DOCUMENT AUTHENTIC"
        status = "valid"
    else:
        message = "DOCUMENT TAMPERED OR INVALID KEY"
        status = "invalid"

    return render_template(
        "index.html",
        message=message,
        status=status,
        active="verify"
    )


if __name__ == "__main__":
    app.run(debug=True)