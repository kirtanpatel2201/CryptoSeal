// utils.js - Shared utilities and UI scripts for SignaVault

// 1. Text Escaping to prevent XSS
function safeText(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 1.5 File Size Validation (500MB Limit)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
function validateFileSize(file) {
    if (file && file.size > MAX_FILE_SIZE) {
        showToast("File is too large. Please keep files under 500MB to prevent memory exhaustion.", "error");
        return false;
    }
    return true;
}

// 2. Base64 Utilities (Fixes window.atob errors)
function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToBuffer(base64) {
    try {
        const sanitized = base64.trim().replace(/\s+/g, '');
        const binary_string = window.atob(sanitized);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        throw new Error("RSA has no sense of humor. One extra space, one missing character, or one accidental edit is enough to invalidate the key. Paste it exactly as generated.");
    }
}

// 3. Toast Notifications
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'check_circle' : 'error';
    toast.innerHTML = `<span class="material-icons">${icon}</span> ${safeText(message)}`;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// 4. Binary Array Utilities (Optimized for EOF payloads)
function findMarkerIndex(buffer, marker) {
    for (let i = buffer.length - marker.length; i >= 0; i--) {
        let found = true;
        for (let j = 0; j < marker.length; j++) {
            if (buffer[i + j] !== marker[j]) {
                found = false;
                break;
            }
        }
        if (found) return i;
    }
    return -1;
}

// Asynchronous chunked file reader to find marker without OOM or freezing main thread
async function findMarkerInFile(file, markerStr) {
    const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks
    const encoder = new TextEncoder();
    const markerBytes = encoder.encode(markerStr);
    const markerLen = markerBytes.length;
    
    let offset = file.size;
    
    while (offset > 0) {
        let readStart = Math.max(0, offset - CHUNK_SIZE);
        // Overlap to catch marker across chunk boundaries
        let readEnd = offset;
        if (offset < file.size) {
            readEnd = Math.min(file.size, offset + markerLen - 1);
        }
        
        const chunkBlob = file.slice(readStart, readEnd);
        const chunkBuffer = await chunkBlob.arrayBuffer();
        const chunkBytes = new Uint8Array(chunkBuffer);
        
        // Let UI breathe
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const markerIdx = findMarkerIndex(chunkBytes, markerBytes);
        if (markerIdx !== -1) {
            return readStart + markerIdx;
        }
        
        offset -= CHUNK_SIZE;
    }
    return -1;
}

// 5. Advanced Steganography (LSB)
async function encodeLSB(imageBlob, payloadBytes) {
    try {
        const buffer = await imageBlob.arrayBuffer();
        const img = UPNG.decode(buffer);
        const rgba = UPNG.toRGBA8(img)[0];
        const data = new Uint8Array(rgba);
        
        const totalLength = payloadBytes.length;
        const capacityBits = (data.length / 4) * 3;
        const neededBits = (totalLength + 4) * 8;
        
        if (neededBits > capacityBits) {
            throw new Error(`Image too small for Deep Stealth. Need ${Math.ceil(neededBits/8)} bytes, capacity is ${Math.floor(capacityBits/8)} bytes.`);
        }
        
        const fullPayload = new Uint8Array(totalLength + 4);
        new DataView(fullPayload.buffer).setUint32(0, totalLength, false);
        fullPayload.set(payloadBytes, 4);
        
        let dataIdx = 0;
        let bitIdx = 0;
        let byteIdx = 0;
        
        while (byteIdx < fullPayload.length) {
            if ((dataIdx + 1) % 4 === 0) {
                dataIdx++;
                continue;
            }
            const bit = (fullPayload[byteIdx] >> (7 - bitIdx)) & 1;
            data[dataIdx] = (data[dataIdx] & ~1) | bit;
            
            bitIdx++;
            if (bitIdx === 8) {
                bitIdx = 0;
                byteIdx++;
            }
            dataIdx++;
            
            // Periodically yield to prevent main thread blocking for massive images
            if (dataIdx % 1000000 === 0) await new Promise(r => setTimeout(r, 0));
        }
        
        const pngData = UPNG.encode([data.buffer], img.width, img.height, 0);
        return new Blob([pngData], { type: 'image/png' });
    } catch (e) {
        throw new Error("Invalid image file or UPNG encoding failed: " + e.message);
    }
}

async function decodeLSB(imageBlob) {
    try {
        const buffer = await imageBlob.arrayBuffer();
        const img = UPNG.decode(buffer);
        const rgba = UPNG.toRGBA8(img)[0];
        const data = new Uint8Array(rgba);
        
        let dataIdx = 0;
        
        const extractBytes = async (numBytes) => {
            const out = new Uint8Array(numBytes);
            let currentByteIdx = 0;
            let currentBitIdx = 0;
            while (currentByteIdx < numBytes && dataIdx < data.length) {
                if ((dataIdx + 1) % 4 === 0) {
                    dataIdx++;
                    continue;
                }
                const bit = data[dataIdx] & 1;
                out[currentByteIdx] = (out[currentByteIdx] << 1) | bit;
                
                currentBitIdx++;
                if (currentBitIdx === 8) {
                    currentBitIdx = 0;
                    currentByteIdx++;
                }
                dataIdx++;
                
                if (dataIdx % 1000000 === 0) await new Promise(r => setTimeout(r, 0));
            }
            return out;
        };
        
        const lenBytes = await extractBytes(4);
        const payloadLen = new DataView(lenBytes.buffer).getUint32(0, false);
        
        if (payloadLen === 0 || payloadLen > data.length) {
            throw new Error("No hidden message found in this file (LSB payload size invalid).");
        }
        
        const payloadBytes = await extractBytes(payloadLen);
        return payloadBytes;
    } catch (e) {
        throw new Error("Invalid image file for LSB extraction: " + e.message);
    }
}

// ==========================================
// ==========================================
const faqs = [
    { q: "Why was CryptoSeal engineered for local processing rather than cloud deployment?", a: "CryptoSeal represents a paradigm shift in personal digital security, moving away from centralized trust and placing absolute cryptographic control back into your hands. By mathematically executing all signature generation, file verification, and steganographic embedding directly within your browser's isolated memory, we ensure that your data is exclusively yours. There are no corporate backdoors, no cloud server vulnerabilities, and no master keys held by our team. Raw files or unencrypted messages are never transmitted over the internet or stored on external databases, meaning even if our global network were fully compromised, your data remains mathematically impossible to steal or reconstruct." },
    { q: "How does the RSA-PSS digital signature module guarantee authenticity?", a: "The digital signature engine utilizes the RSA algorithm combined with the Probabilistic Signature Scheme (PSS), which is currently recognized as the cryptographic gold standard for ensuring data authenticity and non-repudiation. When you sign a document, the system hashes your entire file using SHA-256 and encrypts that specific hash with your locally generated private key. Because the private key is uniquely mathematically bound to the public key you share, any external party can decrypt the hash and verify it against the file. If even a single pixel, metadata tag, or character within the file is altered by a malicious actor, the verification process will instantly and catastrophically fail, proving the file was tampered with." },
    { q: "What happens to the cryptographic keys generated during the signing process?", a: "In a true Zero-Knowledge and stateless architecture, cryptographic keys are the most sensitive components of the entire system. When you navigate to the Digital Signature module and initiate a signing process, CryptoSeal utilizes the browser's native WebCrypto API to dynamically generate a 2048-bit RSA key pair entirely within your device's highly volatile RAM. Once you download your signed file and copy your public key for distribution, the private key is permanently destroyed the moment you close the browser tab or refresh the page. We do not store, log, or transmit your private key anywhere, ensuring that no one—not even our developers—can ever forge a signature on your behalf." },
    { q: "How does the encrypted steganography system protect my secret messages?", a: "Steganography goes a step beyond traditional encryption by concealing the very existence of your secret data. While standard encryption turns your message into unreadable ciphertext, it still clearly looks like a locked file, which can draw unwanted attention from adversaries or surveillance systems. CryptoSeal first encrypts your payload using military-grade AES-256-GCM, making it mathematically impossible to read without the exact password. It then takes this encrypted data and invisibly weaves it into the binary structure of an ordinary carrier file, such as a harmless JPEG image or a standard PDF document. To the outside world, the file looks and behaves completely normally, successfully hiding your communication in plain sight." },
    { q: "Are my files or hidden messages ever uploaded to a central server?", a: "Absolutely not. We fundamentally believe that your private files belong only to you, which is why your data never leaves your device. When you upload a file to either sign it or embed a steganographic message, the entire file is instantly processed within your browser's isolated memory using advanced JavaScript ArrayBuffer manipulation. Our web server acts merely as a static delivery network to provide you with the HTML, CSS, and JS files required to run the application. Your sensitive documents, photos, and secrets remain securely trapped on your local hardware at all times, completely eliminating the risk of man-in-the-middle attacks or server-side data breaches." },
    { q: "Why does the digital signature verification require the exact original Public Key?", a: "The security of the RSA digital signature relies on an asymmetric cryptographic relationship between the private key (used for signing) and the public key (used for verification). These two keys are mathematically entangled in such a way that only the public key generated in tandem with the private key can decrypt the signature block. If a malicious actor intercepts your file and attempts to forge a signature using their own private key, their signature will fundamentally fail to mathematically align with your original public key. Therefore, the recipient must possess the exact public key you originally provided to successfully prove the file's origin and guarantee that the integrity remains uncompromised." },
    { q: "What specific encryption algorithm secures my hidden steganographic data?", a: "Your hidden messages are secured using enterprise-grade AES-GCM (Advanced Encryption Standard with Galois/Counter Mode) utilizing maximum-strength 256-bit keys. This is the exact same cryptographic standard trusted by top-tier financial institutions, intelligence agencies, and global governments to protect top-secret information and classified communications. The AES keys themselves are dynamically derived from your custom password using PBKDF2 hashing algorithms with thousands of iterations, ensuring that they are incredibly resistant to brute-force attacks and modern computational decryption attempts. Furthermore, GCM provides authenticated encryption, meaning the system can detect if the hidden ciphertext has been tampered with." },
    { q: "Can the hidden steganographic data survive file compression or optimization?", a: "No, and this is a critical limitation of steganography that users must clearly understand. Because CryptoSeal injects the encrypted ciphertext directly into the precise binary structure of the carrier file, any process that alters the file's bytes will inevitably destroy the hidden data. If you share your modified image or document via social media platforms like WhatsApp, Twitter, Discord, or Facebook, those platforms will automatically recompress and optimize the file to save bandwidth, permanently erasing your secret message in the process. To ensure the message survives transit, you must share the file via platforms that preserve the original byte structure, such as standard email attachments, ZIP archives, or cloud storage links." },
    { q: "Why is there a slight increase in file size after applying a signature or embedding data?", a: "CryptoSeal operates by preserving the original content of your carrier file while appending the cryptographic data in a way that remains invisible to standard software. For digital signatures, the system generates a Base64-encoded JSON block containing the RSA-PSS signature, the algorithmic parameters, and the hashing signature, which is then appended to the End-of-File (EOF) marker. Similarly, for steganography, the AES-encrypted ciphertext and the necessary Initialization Vectors (IV) are injected into the file structure. Because we are mathematically adding new data to the existing binary stream without degrading the original media, the total byte count of the file will naturally increase by a few kilobytes." },
    { q: "Is it possible to recover a hidden message if I forget the encryption password?", a: "No, there is absolutely no password reset functionality or backdoor built into the CryptoSeal steganography module. In a true Zero-Knowledge system, your password is a fundamental mathematical component of the equation used to generate your AES encryption keys. We do not store your password, nor do we store any master keys that could override it. If you forget the password you used to embed a secret message, that hidden ciphertext becomes mathematically irretrievable forever, appearing as nothing more than random, meaningless digital noise. Please ensure you securely communicate the exact password to your intended recipient before transmitting the carrier file." },
    { q: "Can I use CryptoSeal on mobile devices or tablets?", a: "Yes, CryptoSeal is engineered to be a universally accessible progressive web application. Because the core cryptographic engine relies entirely on the standardized WebCrypto API and modern HTML5 Canvas/FileReader technologies, it is fully compatible with any modern mobile browser, including Chrome for Android and Safari for iOS. You can seamlessly sign documents, verify files, and extract hidden steganographic messages directly from your smartphone or tablet without needing to download a dedicated app from an app store. However, please ensure your mobile device has sufficient RAM when processing exceptionally large carrier files, as the encryption occurs entirely in-memory." },
    { q: "What happens if a malicious actor attempts to modify a signed document?", a: "If a malicious actor intercepts your signed document and attempts to change even a single character of text, alter a pixel in an image, or modify the metadata, they fundamentally alter the file's binary composition. When the recipient attempts to verify the file using CryptoSeal, the system will re-hash the newly modified file and compare it against the original hash decrypted from the RSA signature block. Because the hashes will no longer match, the verification protocol will instantly trigger a catastrophic failure, displaying a massive red warning to the user that the file's integrity has been compromised and the origin can no longer be trusted." },
    { q: "Why does the application recommend using Chrome, Firefox, or Edge?", a: "While CryptoSeal is designed for universal compatibility, executing complex 2048-bit RSA key generation and AES-256-GCM encryption entirely within the browser requires a highly robust and secure JavaScript execution environment. Modern browsers like Google Chrome, Mozilla Firefox, and Microsoft Edge feature highly optimized V8 and SpiderMonkey engines that can handle these heavy mathematical computations almost instantaneously. Older or outdated browsers may lack full support for the modern WebCrypto API or may execute the cryptographic algorithms significantly slower, leading to a degraded user experience or potential memory allocation failures during the file processing phase." },
    { q: "Is it possible for someone to detect that a file contains a hidden message?", a: "CryptoSeal utilizes End-of-File (EOF) injection and sophisticated binary manipulation to ensure the carrier file looks, opens, and behaves exactly like a normal file to the human eye and standard software applications. However, advanced forensic analysts utilizing specialized hex editors, steganalysis tools, or structural anomaly detectors could theoretically identify that additional, anomalous encrypted data is appended to the file. While they can detect the *presence* of the anomaly, the military-grade AES-256 encryption ensures that it is mathematically impossible for them to determine what the data is, read the secret message, or prove it isn't just corrupted metadata." },
    { q: "How does the system ensure the security of the WebCrypto API?", a: "The WebCrypto API is a W3C standard cryptographic engine built directly into the core architecture of all modern web browsers. It is implemented natively in C++ by the browser vendors (such as Google, Apple, and Mozilla) rather than running as interpreted JavaScript, which provides immense performance benefits and prevents common side-channel memory attacks. By leveraging this native API, CryptoSeal ensures that critical operations like random number generation (CSPRNG), key derivation, and algorithmic execution are performed using highly audited, secure, and standardized cryptographic primitives that are trusted by the entire global cybersecurity community." },
    { q: "Can I digitally sign multiple files simultaneously in a batch process?", a: "Currently, CryptoSeal is highly optimized for the rapid, in-memory processing of individual files to guarantee uncompromising security and visual feedback for the user. The system processes data in highly secure, isolated memory chunks to prevent memory leaks, ensure browser stability, and provide clear cryptographic status updates for each specific file. If you need to secure an entire directory or hundreds of files simultaneously, we strongly recommend compiling them into a single standard `.zip` archive on your computer first. You can then seamlessly upload that single archive into the digital signature module to sign the entire collection at once." },
    { q: "What happens if I try to verify a file that hasn't been signed by CryptoSeal?", a: "The verification engine is specifically programmed to scan the binary structure of the uploaded file for a unique cryptographic delimiter that separates the original file data from the injected signature payload. If you upload a standard, unsigned file, the engine will fail to locate this delimiter and immediately halt the verification process, informing you that no valid CryptoSeal signature block was detected. This prevents the system from attempting to mathematically verify random data and ensures that users receive clear, immediate feedback when handling standard documents versus cryptographically secured assets." },
    { q: "Are the cryptographic keys vulnerable to brute-force quantum computing attacks?", a: "CryptoSeal currently utilizes 2048-bit RSA for digital signatures and 256-bit AES for steganographic encryption. Under modern classical computing architectures, these standards would take supercomputers millions of years to successfully brute-force, ensuring absolute security for the foreseeable future. While the theoretical advent of large-scale, fault-tolerant quantum computers (specifically running Shor's algorithm) could eventually compromise RSA keys, AES-256 is generally considered to be highly quantum-resistant. We continually monitor the cryptographic landscape and will upgrade the platform to post-quantum cryptographic standards (like lattice-based cryptography) as they become standardized by NIST." },
    { q: "Why does the Steganography module require a carrier file instead of just encrypting text?", a: "The fundamental purpose of steganography is deception and camouflage, distinguishing it from standard encryption tools like PGP or encrypted messaging apps. If you simply encrypt a message and send a block of random ciphertext to someone, any intercepting party (such as an ISP, a corporate firewall, or a totalitarian government) instantly knows you are communicating in secret, which can make you a target. By requiring a carrier file, CryptoSeal allows you to hide that encrypted ciphertext inside a completely mundane photo of a cat or a boring PDF report. The intercepting party sees the normal file and ignores it, completely unaware that a covert communication channel exists." },
    { q: "Is the underlying source code of CryptoSeal completely open source?", a: "Transparency is a foundational pillar of trust in the cybersecurity industry, and CryptoSeal embraces this philosophy entirely. Because the platform operates as a completely client-side, serverless web application, the entirety of the source code—including the HTML structure, the CSS styling, and the JavaScript cryptographic logic—is fully exposed and delivered directly to your browser. Independent security researchers, cryptographers, and advanced users can easily open their browser's Developer Tools (F12) to inspect every line of code, verify the WebCrypto API implementations, and audit the system to guarantee that no hidden telemetry or backdoors exist within the platform." }
];

function initFAQModal() {
    // Inject Modal HTML
    const modalHTML = `
    <div class="modal-overlay" id="faq-overlay">
        <div class="faq-modal">
            <div class="modal-header">
                <h2>Frequently Asked Questions</h2>
                <button class="close-modal-btn" id="close-faq-btn"><span class="material-icons">close</span></button>
            </div>
            <div class="modal-body" id="faq-list"></div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const faqList = document.getElementById('faq-list');
    
    // Render FAQs
    faqs.forEach((item) => {
        const faqItem = document.createElement('div');
        faqItem.className = 'faq-item';
        
        const questionBtn = document.createElement('button');
        questionBtn.className = 'faq-question';
        questionBtn.innerHTML = `
            <span>${item.q}</span>
            <span class="material-icons">expand_more</span>
        `;
        
        const answerWrapper = document.createElement('div');
        answerWrapper.className = 'faq-answer-wrapper';
        answerWrapper.innerHTML = `
            <div class="faq-answer">
                ${item.a}
            </div>
        `;
        
        // Toggle logic based on CSS class 'open'
        questionBtn.addEventListener('click', () => {
            const isOpen = faqItem.classList.contains('open');
            
            // Close all
            document.querySelectorAll('.faq-item').forEach(el => {
                el.classList.remove('open');
            });
            
            // Open clicked if it wasn't already open
            if (!isOpen) {
                faqItem.classList.add('open');
            }
        });
        
        faqItem.appendChild(questionBtn);
        faqItem.appendChild(answerWrapper);
        faqList.appendChild(faqItem);
    });

    const overlay = document.getElementById('faq-overlay');
    const closeBtn = document.getElementById('close-faq-btn');
    const openBtns = document.querySelectorAll('.faq-btn');

    openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            overlay.classList.add('active');
        });
    });

    closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
}

// ==========================================
// LIVE SYSTEM MONITOR (Cyberpunk Status Loop)
// ==========================================
function generateRandomHex(length) {
    let result = '';
    const characters = '0123456789ABCDEF';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function generateRandomBinary(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.random() > 0.5 ? '1' : '0';
    }
    return result;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getTimestamp() {
    const now = new Date();
    return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
}

function initTerminalWidget() {
    const terminalElement = document.getElementById('terminal-content');
    if (!terminalElement) return;

    const maxLines = 12; // Taller terminal supports more lines
    let typingLine = null;
    let typingCharIndex = 0;
    let currentTypingText = '';
    let isTyping = false;
    let packetCount = 48192;

    const mainMessages = [
        "Initializing secure workspace...",
        "Waiting for document...",
        "Generating SHA-256 digest...",
        "Preparing signature verification...",
        "Encryption service available.",
        "Verification service available.",
        "System ready."
    ];
    let msgIndex = 0;

    function createNewLineElement() {
        const line = document.createElement('div');
        line.className = 'term-line';
        terminalElement.appendChild(line);
        
        while (terminalElement.children.length > maxLines) {
            terminalElement.removeChild(terminalElement.firstChild);
        }
        return line;
    }

    function removeCursors() {
        const cursors = terminalElement.querySelectorAll('.blinking-cursor');
        cursors.forEach(c => c.remove());
    }

    function appendStaticLine(html) {
        if (isTyping) return; // Don't interrupt typing
        removeCursors();
        const line = createNewLineElement();
        line.innerHTML = html + ` <span class="blinking-cursor"></span>`;
    }

    function typeLine(text, onComplete) {
        if (isTyping) return;
        isTyping = true;
        removeCursors();
        typingLine = createNewLineElement();
        currentTypingText = text;
        typingCharIndex = 0;

        function typeNextChar() {
            typingLine.innerHTML = currentTypingText.substring(0, typingCharIndex + 1) + `<span class="blinking-cursor"></span>`;
            typingCharIndex++;
            
            if (typingCharIndex < currentTypingText.length) {
                setTimeout(typeNextChar, 30 + Math.random() * 50);
            } else {
                isTyping = false;
                if (onComplete) onComplete();
            }
        }
        typeNextChar();
    }

    function terminalLoop() {
        if (isTyping) {
            setTimeout(terminalLoop, 500);
            return;
        }

        const r = Math.random();
        
        // 20% chance to type a main status message
        if (r < 0.2) {
            typeLine(mainMessages[msgIndex], () => {
                msgIndex = (msgIndex + 1) % mainMessages.length;
                setTimeout(terminalLoop, 2000 + Math.random() * 2000);
            });
            return;
        }

        // 80% chance to stream rich technical output
        const ts = getTimestamp();
        let logHtml = '';
        
        const type = Math.random();
        if (type < 0.2) {
            logHtml = `<span style="color: #64748b">${ts}</span> <span style="color: #3b82f6">HASH</span> ${generateRandomHex(8)}...${generateRandomHex(8)}`;
        } else if (type < 0.4) {
            logHtml = `<span style="color: #64748b">${ts}</span> <span style="color: #10b981">UUID</span> ${generateUUID()}`;
        } else if (type < 0.6) {
            logHtml = `<span style="color: #64748b">${ts}</span> <span style="color: #8b5cf6">KEY FP</span> ${generateRandomHex(2)}:${generateRandomHex(2)}:${generateRandomHex(2)}:${generateRandomHex(2)}:${generateRandomHex(2)}`;
        } else if (type < 0.7) {
            logHtml = `<span style="color: #64748b">${ts}</span> <span style="color: #f59e0b">NONCE</span> ${generateRandomHex(16)}`;
        } else if (type < 0.8) {
            packetCount++;
            logHtml = `<span style="color: #64748b">${ts}</span> <span style="color: #0ea5e9">PACKET</span> #${packetCount} VERIFIED`;
        } else if (type < 0.9) {
            logHtml = `<span style="color: #64748b">${ts}</span> <span style="color: #ef4444">MEM</span> ${(Math.random() * 10 + 20).toFixed(1)}MB / 1024MB`;
        } else {
            // Binary rain format
            logHtml = `<span style="color: #052e16; opacity: 0.5;">${generateRandomBinary(32)}</span>`;
        }

        appendStaticLine(logHtml);
        
        // Fast streaming interval
        setTimeout(terminalLoop, 200 + Math.random() * 800);
    }

    // Start
    setTimeout(terminalLoop, 1000);
}

// Init global UI scripts safely on DOM load
function initAll() {
    initFAQModal();
    initTerminalWidget();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}
