# CryptoSeal 🔐

### Cryptographic Document Signing & Verification System

CryptoSeal is a secure document signing and verification system designed to demonstrate the principles of **cryptographic hashing and digital signatures**.

The system allows users to sign documents and later verify their authenticity to detect tampering or unauthorized modifications.

---

# 🚀 Features

* 📄 Sign documents using cryptographic hashing
* 🔑 Public key generation for verification
* 🔍 Verify document integrity
* 🛡 Detect document tampering
* 🔐 Secure encrypted vault for signature storage
* ⚡ Lightweight web interface built using Flask
* 🎨 Modern cybersecurity-themed UI

---

# 🧠 How It Works

CryptoSeal follows a simplified digital signature workflow:

### 1. Document Signing

1. User uploads a document.
2. The system generates a **SHA-256 hash** of the file.
3. The hash is combined with a private key to generate a signature.
4. A **32-bit public key** is generated and shown to the user.
5. The public key and signature are securely stored in an encrypted vault.

### 2. Document Verification

1. User uploads the document again.
2. User provides the previously generated public key.
3. The system hashes the document again.
4. The vault retrieves the stored signature associated with the public key.
5. The system verifies integrity by comparing signatures.

If hashes match → ✅ Document is authentic
If hashes differ → ❌ Document has been tampered

---

# 🏗 Project Architecture

```
User File
   │
   ▼
SHA-256 Hash
   │
   ▼
Signature Generation
   │
   ▼
Encrypted Vault Storage
   │
   ▼
Verification using Public Key
```

---

# 🛠 Tech Stack

**Backend**

* Python
* Flask

**Cryptography Concepts**

* SHA-256 Hashing
* Asymmetric Key Concept
* Digital Signature Workflow

**Frontend**

* HTML
* CSS
* JavaScript

**Security**

* Encrypted Vault Storage

---

# 📂 Project Structure

```
pdf-signature-tool/
│
├── app.py
│
├── templates/
│   └── index.html
│
├── static/
│   └── style.css
│
├── vault.enc
│
├── requirements.txt

```

---

# ⚙ Installation

Clone the repository:

```
git clone https://github.com/yourusername/CryptoSeal.git
```

Navigate into the project directory:

```
cd CryptoSeal/pdf-signature-tool
```

Install dependencies:

```
pip install -r requirements.txt
```

Run the application:

```
python app.py
```

Open in browser:

```
http://127.0.0.1:5000
```

---

# 📸 Application Workflow

### Signing a Document

1. Upload file
2. Generate public key
3. Store signature securely

### Verifying a Document

1. Upload file
2. Enter public key
3. Validate document integrity

---

# 🎯 Use Cases

* Demonstrating **digital signature concepts**
* Academic cryptography projects
* Document integrity verification
* Secure file authentication systems


---

# 📚 Educational Purpose

This project was developed as part of a **Cryptography subject project** to demonstrate the practical implementation of document signing and verification systems.

---

# 👨‍💻 Author

**Kirtan Patel**

Cybersecurity & Software Development Enthusiast

GitHub: https://github.com/kirtanpatel2201

---

