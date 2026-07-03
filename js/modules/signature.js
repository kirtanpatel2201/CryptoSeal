// --- UI Elements ---
const tabSign = document.getElementById('tab-sign');
const tabVerify = document.getElementById('tab-verify');
const contentSign = document.getElementById('content-sign');
const contentVerify = document.getElementById('content-verify');

// Sign Tab Elements
const dropZoneSign = document.getElementById('drop-zone-sign');
const fileInputSign = document.getElementById('file-input-sign');
const fileInfoSign = document.getElementById('file-info-sign');
const filenameSign = document.getElementById('filename-sign');
const removeFileSignBtn = document.getElementById('remove-file-sign');
const inputSignMessage = document.getElementById('input-sign-message');
const btnSign = document.getElementById('btn-sign');
const resultSign = document.getElementById('result-sign');
const downloadPackageBtn = document.getElementById('download-package-btn');
const outputPublicKey = document.getElementById('output-public-key');
const copyPubKeyBtn = document.getElementById('copy-pub-key-btn');

// Verify Tab Elements
const dropZoneVerifyPdf = document.getElementById('drop-zone-verify-pdf');
const fileInputVerifyPdf = document.getElementById('file-input-verify-pdf');
const fileInfoVerifyPdf = document.getElementById('file-info-verify-pdf');
const filenameVerifyPdf = document.getElementById('filename-verify-pdf');
const removeFileVerifyPdfBtn = document.getElementById('remove-file-verify-pdf');
const inputVerifyPubkey = document.getElementById('input-verify-pubkey');
const btnVerify = document.getElementById('btn-verify');
const resultVerify = document.getElementById('result-verify');

// State
let signFile = null;
let verifyPdfFile = null;
let generatedPackageUrl = null;

const MARKER = "SIG_DATA_START";

// --- Tab Switching ---
tabSign.addEventListener('click', () => {
    tabSign.classList.add('active');
    tabVerify.classList.remove('active');
    contentSign.classList.remove('hidden');
    contentVerify.classList.add('hidden');
});

tabVerify.addEventListener('click', () => {
    tabVerify.classList.add('active');
    tabSign.classList.remove('active');
    contentVerify.classList.remove('hidden');
    contentSign.classList.add('hidden');
});

// --- Cryptography (WebCrypto API) ---

async function getHashFromBuffer(buffer) {
    return await crypto.subtle.digest('SHA-256', buffer);
}

async function generateKeyPair() {
    return await crypto.subtle.generateKey(
        {
            name: "RSA-PSS",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["sign", "verify"]
    );
}

// --- Sign Logic ---

function updateSignUI() {
    if (signFile) {
        dropZoneSign.classList.add('hidden');
        fileInfoSign.classList.remove('hidden');
        filenameSign.textContent = signFile.name;
    } else {
        dropZoneSign.classList.remove('hidden');
        fileInfoSign.classList.add('hidden');
        fileInputSign.value = "";
    }
    btnSign.disabled = !(signFile && inputSignMessage.value.trim().length > 0);
}

// File Drag & Drop (Sign)
dropZoneSign.addEventListener('click', (e) => {
    if (e.target !== fileInputSign) fileInputSign.click();
});
dropZoneSign.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneSign.classList.add('dragover'); });
dropZoneSign.addEventListener('dragleave', () => dropZoneSign.classList.remove('dragover'));
dropZoneSign.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZoneSign.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        signFile = e.dataTransfer.files[0];
        updateSignUI();
    }
});
fileInputSign.addEventListener('change', (e) => {
    if (e.target.files.length) {
        signFile = e.target.files[0];
        updateSignUI();
    }
});
removeFileSignBtn.addEventListener('click', () => {
    signFile = null;
    resultSign.classList.add('hidden');
    updateSignUI();
});
inputSignMessage.addEventListener('input', updateSignUI);

// Copy Public Key button
copyPubKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(outputPublicKey.value).then(() => {
        showToast("Public Key Copied!", "success");
        const icon = copyPubKeyBtn.querySelector('.material-icons');
        icon.textContent = 'check';
        setTimeout(() => icon.textContent = 'content_copy', 2000);
    });
});

// Generate Signature
btnSign.addEventListener('click', async () => {
    try {
        btnSign.disabled = true;
        
        // Safe Text Update
        btnSign.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        btnSign.appendChild(icon);
        btnSign.appendChild(document.createTextNode(' Processing...'));

        // Let the UI paint the "Processing..." state
        await new Promise(resolve => setTimeout(resolve, 50));

        const username = inputSignMessage.value.trim();
        
        const keyPair = await generateKeyPair();
        const originalFileBuffer = await signFile.arrayBuffer();
        const pdfHashBuffer = await getHashFromBuffer(originalFileBuffer);
        
        const encoder = new TextEncoder();
        const usernameBuffer = encoder.encode(username);
        
        const combinedBuffer = new Uint8Array(pdfHashBuffer.byteLength + usernameBuffer.byteLength);
        combinedBuffer.set(new Uint8Array(pdfHashBuffer), 0);
        combinedBuffer.set(usernameBuffer, pdfHashBuffer.byteLength);

        const signatureBuffer = await crypto.subtle.sign(
            { name: "RSA-PSS", saltLength: 32 },
            keyPair.privateKey,
            combinedBuffer
        );

        const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
        const pubKeyString = JSON.stringify(publicKeyJwk);
        const pubKeyBase64 = bufferToBase64(encoder.encode(pubKeyString));
        
        const signaturePayload = {
            signatureMessage: username,
            signature: bufferToBase64(signatureBuffer),
            timestamp: new Date().toISOString()
        };
        
        const payloadString = JSON.stringify(signaturePayload);
        const payloadBuffer = encoder.encode(payloadString);
        const markerBytes = encoder.encode(MARKER);
        
        // Create the blob directly from the original file + marker + payload (Zero memory duplication)
        const blob = new Blob([signFile, markerBytes, payloadBuffer], { type: signFile.type });
        if (generatedPackageUrl) URL.revokeObjectURL(generatedPackageUrl);
        generatedPackageUrl = URL.createObjectURL(blob);
        
        outputPublicKey.value = pubKeyBase64;
        
        const nameParts = signFile.name.split('.');
        let outName = signFile.name + '_signed';
        if (nameParts.length > 1) {
            const ext = nameParts.pop();
            outName = nameParts.join('.') + '_signed.' + ext;
        }
        
        downloadPackageBtn.href = generatedPackageUrl;
        downloadPackageBtn.download = outName;

        resultSign.classList.remove('hidden');
        showToast("Signature Generated Successfully", "success");

    } catch (err) {
        console.error(err);
        showToast("Error generating signature", "error");
    } finally {
        btnSign.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = 'draw';
        btnSign.appendChild(icon);
        btnSign.appendChild(document.createTextNode(' Sign Document'));
        updateSignUI();
    }
});


// --- Verify Logic ---

function updateVerifyUI() {
    if (verifyPdfFile) {
        dropZoneVerifyPdf.classList.add('hidden');
        fileInfoVerifyPdf.classList.remove('hidden');
        filenameVerifyPdf.textContent = verifyPdfFile.name;
    } else {
        dropZoneVerifyPdf.classList.remove('hidden');
        fileInfoVerifyPdf.classList.add('hidden');
        fileInputVerifyPdf.value = "";
    }
    btnVerify.disabled = !(verifyPdfFile && inputVerifyPubkey.value.trim().length > 0);
}

// File Drag & Drop (Verify - PDF)
dropZoneVerifyPdf.addEventListener('click', (e) => {
    if (e.target !== fileInputVerifyPdf) fileInputVerifyPdf.click();
});
dropZoneVerifyPdf.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneVerifyPdf.classList.add('dragover'); });
dropZoneVerifyPdf.addEventListener('dragleave', () => dropZoneVerifyPdf.classList.remove('dragover'));
dropZoneVerifyPdf.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZoneVerifyPdf.classList.remove('dragover');
    if (e.dataTransfer.files.length) { verifyPdfFile = e.dataTransfer.files[0]; updateVerifyUI(); }
});
fileInputVerifyPdf.addEventListener('change', (e) => {
    if (e.target.files.length) { verifyPdfFile = e.target.files[0]; updateVerifyUI(); }
});
removeFileVerifyPdfBtn.addEventListener('click', () => { verifyPdfFile = null; resultVerify.classList.add('hidden'); updateVerifyUI(); });
inputVerifyPubkey.addEventListener('input', updateVerifyUI);

// Verify Signature
btnVerify.addEventListener('click', async () => {
    try {
        btnVerify.disabled = true;
        
        btnVerify.textContent = '';
        const btnIcon = document.createElement('span');
        btnIcon.className = 'material-icons';
        btnIcon.textContent = 'hourglass_empty';
        btnVerify.appendChild(btnIcon);
        btnVerify.appendChild(document.createTextNode(' Verifying...'));
        
        // Let the UI paint the "Verifying..." state
        await new Promise(resolve => setTimeout(resolve, 50));
        
        resultVerify.classList.add('hidden');

        const encoder = new TextEncoder();
        const markerBytes = encoder.encode(MARKER);
        
        let markerIndex = await findMarkerInFile(verifyPdfFile, MARKER);
        
        if (markerIndex === -1) {
            throw new Error("Trust requires proof. This file contains no digital signature, so its origin and integrity cannot be verified.");
        }
        
        const originalFileBlob = verifyPdfFile.slice(0, markerIndex);
        const payloadBlob = verifyPdfFile.slice(markerIndex + markerBytes.length);
        
        const payloadBuffer = await payloadBlob.arrayBuffer();
        const payloadBytes = new Uint8Array(payloadBuffer);
        
        const decoder = new TextDecoder();
        const payloadString = decoder.decode(payloadBytes);
        
        let payload;
        try {
            payload = JSON.parse(payloadString);
        } catch(e) {
            throw new Error("Signature payload is corrupted.");
        }
        
        if (!payload.signature || !payload.signatureMessage) {
            throw new Error("Invalid signature payload in the document.");
        }

        // Parse Public Key (now protected by base64ToBuffer validation)
        const pubKeyBase64 = inputVerifyPubkey.value.trim();
        const pubKeyBytes = base64ToBuffer(pubKeyBase64);
        const pubKeyString = decoder.decode(pubKeyBytes);
        
        let publicKeyJwk;
        try {
            publicKeyJwk = JSON.parse(pubKeyString);
        } catch(e) {
            throw new Error("Public Key is invalid JSON.");
        }

        const publicKey = await crypto.subtle.importKey(
            "jwk",
            publicKeyJwk,
            { name: "RSA-PSS", hash: "SHA-256" },
            true,
            ["verify"]
        ).catch(() => { throw new Error("Cryptographic Key Import Failed. Key is invalid."); });

        const originalFileBuffer = await originalFileBlob.arrayBuffer();
        const originalFileBytes = new Uint8Array(originalFileBuffer);
        const pdfHashBuffer = await getHashFromBuffer(originalFileBytes);

        const usernameBuffer = encoder.encode(payload.signatureMessage);
        const combinedBuffer = new Uint8Array(pdfHashBuffer.byteLength + usernameBuffer.byteLength);
        combinedBuffer.set(new Uint8Array(pdfHashBuffer), 0);
        combinedBuffer.set(usernameBuffer, pdfHashBuffer.byteLength);

        const signatureBuffer = base64ToBuffer(payload.signature);
        const isValid = await crypto.subtle.verify(
            { name: "RSA-PSS", saltLength: 32 },
            publicKey,
            signatureBuffer,
            combinedBuffer
        );

        // Render Safely (No innerHTML for user data)
        resultVerify.innerHTML = '';
        
        if (isValid) {
            // Success Header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'success-header';
            headerDiv.innerHTML = `<span class="material-icons text-success" style="font-size: 2rem;">verified</span><h3 class="text-success">Document is Authentic</h3>`;
            
            const desc = document.createElement('p');
            desc.textContent = 'The signature mathematically matches the file and the public key.';
            
            const detailDiv = document.createElement('div');
            detailDiv.className = 'result-detail';
            
            detailDiv.innerHTML = `<strong>Signed By (Message):</strong> ${safeText(payload.signatureMessage)}<br>
                                   <strong>Timestamp:</strong> ${safeText(new Date(payload.timestamp).toLocaleString())}<br>
                                   <strong>Original File:</strong> ${safeText(verifyPdfFile.name)}`;
            
            resultVerify.appendChild(headerDiv);
            resultVerify.appendChild(desc);
            resultVerify.appendChild(detailDiv);
            showToast("Document Verified", "success");
        } else {
            throw new Error("Tamper Detected: The document has been modified since it was signed, or the wrong key was provided.");
        }

        resultVerify.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        resultVerify.innerHTML = '';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'error-header';
        headerDiv.innerHTML = `<span class="material-icons text-error">gpp_bad</span><h3 class="text-error">Verification Failed</h3>`;
        
        const desc = document.createElement('p');
        desc.textContent = err.message;
        
        resultVerify.appendChild(headerDiv);
        resultVerify.appendChild(desc);
        resultVerify.classList.remove('hidden');
        showToast("Verification Failed", "error");
    } finally {
        btnVerify.textContent = '';
        const btnIcon = document.createElement('span');
        btnIcon.className = 'material-icons';
        btnIcon.textContent = 'verified';
        btnVerify.appendChild(btnIcon);
        btnVerify.appendChild(document.createTextNode(' Verify Integrity'));
        updateVerifyUI();
    }
});
