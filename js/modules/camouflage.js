// camouflage.js - Dedicated Image Hiding Module

// --- UI Elements ---
const heroSelection = document.getElementById('hero-selection');
const stegoWorkspace = document.getElementById('stego-workspace');
const selectEngineEof = document.getElementById('select-engine-eof');
const selectEngineLsb = document.getElementById('select-engine-lsb');
const btnBackHero = document.getElementById('btn-back-hero');
const workspaceEngineIcon = document.getElementById('workspace-engine-icon');
const workspaceEngineTitle = document.getElementById('workspace-engine-title');

const tabEmbed = document.getElementById('tab-embed');
const tabExtract = document.getElementById('tab-extract');
const contentEmbed = document.getElementById('content-embed');
const contentExtract = document.getElementById('content-extract');

// Embed Tab
const dropZoneEmbed = document.getElementById('drop-zone-embed');
const fileInputEmbed = document.getElementById('file-input-embed');
const fileInfoEmbed = document.getElementById('file-info-embed');
const filenameEmbed = document.getElementById('filename-embed');
const removeFileEmbedBtn = document.getElementById('remove-file-embed');

const capacityIndicator = document.getElementById('capacity-indicator');
const capacityValue = document.getElementById('capacity-value');
const conversionWarning = document.getElementById('conversion-warning');

const radioPayloadInputs = document.querySelectorAll('input[name="payload_type"]');
const lblPayloadText = document.getElementById('lbl-payload-text');
const lblPayloadFile = document.getElementById('lbl-payload-file');

const payloadTextContent = document.getElementById('payload-text-content');
const payloadFileContent = document.getElementById('payload-file-content');
const inputStegoMessage = document.getElementById('input-stego-message');

const dropZoneSecret = document.getElementById('drop-zone-secret-file');
const fileInputSecret = document.getElementById('file-input-secret');
const fileInfoSecret = document.getElementById('file-info-secret');
const filenameSecret = document.getElementById('filename-secret');
const removeSecretBtn = document.getElementById('remove-secret-file');

const btnEmbed = document.getElementById('btn-embed');
const resultEmbed = document.getElementById('result-embed');
const outputEmbedKey = document.getElementById('output-embed-key');
const copyStegoKeyBtn = document.getElementById('copy-stego-key-btn');
const downloadStegoBtn = document.getElementById('download-stego-btn');

// Extract Tab
const dropZoneExtract = document.getElementById('drop-zone-extract');
const fileInputExtract = document.getElementById('file-input-extract');
const fileInfoExtract = document.getElementById('file-info-extract');
const filenameExtract = document.getElementById('filename-extract');
const removeFileExtractBtn = document.getElementById('remove-file-extract');
const inputStegoKey = document.getElementById('input-stego-key');
const btnExtract = document.getElementById('btn-extract');
const resultExtract = document.getElementById('result-extract');

// State
let embedFile = null;
let secretFile = null;
let extractFile = null;
let generatedFileUrl = null;
let activeExtractUrl = null;
let isTextMode = true;
let isLsbMode = false;
let currentMaxCapacity = 0; // bytes

const MARKER = "STEGO_DATA_START";

// --- Hero Routing ---
function activateWorkspace(lsb) {
    isLsbMode = lsb;
    if (lsb) {
        workspaceEngineIcon.textContent = 'wallpaper';
        workspaceEngineIcon.className = 'material-icons text-success';
        workspaceEngineTitle.textContent = 'Deep Pixel Stealth';
    } else {
        workspaceEngineIcon.textContent = 'visibility_off';
        workspaceEngineIcon.className = 'material-icons text-cyan';
        workspaceEngineTitle.textContent = 'Standard Injection';
    }
    heroSelection.classList.add('hidden');
    stegoWorkspace.classList.remove('hidden');
    calculateCapacity();
}

selectEngineEof.addEventListener('click', () => activateWorkspace(false));
selectEngineLsb.addEventListener('click', () => activateWorkspace(true));

btnBackHero.addEventListener('click', () => {
    stegoWorkspace.classList.add('hidden');
    heroSelection.classList.remove('hidden');
    
    // Reset state
    embedFile = null;
    secretFile = null;
    extractFile = null;
    updateEmbedUI();
    updateExtractUI();
    resultEmbed.classList.add('hidden');
    resultExtract.classList.add('hidden');
});


// --- Tab Switching ---
tabEmbed.addEventListener('click', () => {
    tabEmbed.classList.add('active');
    tabExtract.classList.remove('active');
    contentEmbed.classList.remove('hidden');
    contentExtract.classList.add('hidden');
});

tabExtract.addEventListener('click', () => {
    tabExtract.classList.add('active');
    tabEmbed.classList.remove('active');
    contentExtract.classList.remove('hidden');
    contentEmbed.classList.add('hidden');
});

// --- Payload Radio ---
radioPayloadInputs.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'text') {
            isTextMode = true;
            lblPayloadText.classList.add('active');
            lblPayloadText.style.background = 'rgba(255,255,255,0.08)';
            lblPayloadText.style.color = '#fff';
            
            lblPayloadFile.classList.remove('active');
            lblPayloadFile.style.background = 'transparent';
            lblPayloadFile.style.color = 'var(--text-muted)';
            
            payloadTextContent.classList.remove('hidden');
            payloadFileContent.classList.add('hidden');
        } else {
            isTextMode = false;
            lblPayloadFile.classList.add('active');
            lblPayloadFile.style.background = 'rgba(255,255,255,0.08)';
            lblPayloadFile.style.color = '#fff';
            
            lblPayloadText.classList.remove('active');
            lblPayloadText.style.background = 'transparent';
            lblPayloadText.style.color = 'var(--text-muted)';
            
            payloadFileContent.classList.remove('hidden');
            payloadTextContent.classList.add('hidden');
        }
        updateEmbedUI();
    });
});

// --- Capacity Calculation ---
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculateCapacity() {
    if (!embedFile) {
        capacityIndicator.classList.add('hidden');
        return;
    }

    if (!isLsbMode) {
        capacityIndicator.classList.remove('hidden');
        capacityValue.textContent = 'Unlimited (Restricted by RAM)';
        capacityValue.style.color = 'var(--cyan)';
        currentMaxCapacity = Infinity;
        updateEmbedUI();
        return;
    }

    // LSB Mode Capacity Calculation
    capacityIndicator.classList.remove('hidden');
    capacityValue.textContent = 'Analyzing image...';
    capacityValue.style.color = 'var(--text-muted)';
    
    const url = URL.createObjectURL(embedFile);
    const img = new Image();
    img.onload = () => {
        // We use 3 bits per pixel (R, G, B channels). 
        // Max capacity in bits = width * height * 3. In bytes = (w * h * 3) / 8.
        const maxBytes = Math.floor((img.width * img.height * 3) / 8);
        currentMaxCapacity = maxBytes;
        
        const safeBytes = Math.floor(maxBytes * 0.95); // leave some buffer
        
        capacityValue.textContent = `${formatBytes(safeBytes)} / ${safeBytes.toLocaleString()} characters`;
        capacityValue.style.color = 'var(--success)';
        
        URL.revokeObjectURL(url);
        updateEmbedUI();
    };
    img.onerror = () => {
        capacityValue.textContent = 'Error reading image dimensions';
        capacityValue.style.color = 'var(--error)';
        currentMaxCapacity = 0;
        updateEmbedUI();
    };
    img.src = url;
}

// --- Embed Logic ---
function updateEmbedUI() {
    if (embedFile) {
        dropZoneEmbed.classList.add('hidden');
        fileInfoEmbed.classList.remove('hidden');
        filenameEmbed.textContent = embedFile.name;
    } else {
        dropZoneEmbed.classList.remove('hidden');
        fileInfoEmbed.classList.add('hidden');
        fileInputEmbed.value = "";
    }

    if (secretFile) {
        dropZoneSecret.classList.add('hidden');
        fileInfoSecret.classList.remove('hidden');
        filenameSecret.textContent = secretFile.name;
    } else {
        dropZoneSecret.classList.remove('hidden');
        fileInfoSecret.classList.add('hidden');
        fileInputSecret.value = "";
    }

    let payloadSize = 0;
    let hasPayload = false;
    
    if (isTextMode) {
        const text = inputStegoMessage.value.trim();
        hasPayload = text.length > 0;
        payloadSize = new TextEncoder().encode(text).length;
    } else {
        hasPayload = !!secretFile;
        payloadSize = secretFile ? secretFile.size : 0;
    }

    if (conversionWarning) {
        if (embedFile && isLsbMode && embedFile.type !== 'image/png') {
            conversionWarning.classList.remove('hidden');
        } else {
            conversionWarning.classList.add('hidden');
        }
    }

    // Rough check for capacity limits
    const isWithinLimits = payloadSize < currentMaxCapacity;
    
    if (embedFile && isLsbMode && !isWithinLimits && hasPayload) {
        capacityValue.style.color = 'var(--error)';
        btnEmbed.disabled = true;
    } else if (embedFile && isLsbMode && isWithinLimits) {
        capacityValue.style.color = 'var(--success)';
        btnEmbed.disabled = !(embedFile && hasPayload);
    } else {
        btnEmbed.disabled = !(embedFile && hasPayload);
    }
}

// Drag & Drop Carrier File
dropZoneEmbed.addEventListener('click', (e) => { if (e.target !== fileInputEmbed) fileInputEmbed.click(); });
dropZoneEmbed.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneEmbed.classList.add('dragover'); });
dropZoneEmbed.addEventListener('dragleave', () => dropZoneEmbed.classList.remove('dragover'));
dropZoneEmbed.addEventListener('drop', (e) => {
    e.preventDefault(); dropZoneEmbed.classList.remove('dragover');
    if (e.dataTransfer.files.length) { 
        embedFile = e.dataTransfer.files[0]; 
        calculateCapacity();
    }
});
fileInputEmbed.addEventListener('change', (e) => {
    if (e.target.files.length) { 
        embedFile = e.target.files[0]; 
        calculateCapacity();
    }
});
removeFileEmbedBtn.addEventListener('click', () => { 
    embedFile = null; 
    resultEmbed.classList.add('hidden'); 
    calculateCapacity();
});
inputStegoMessage.addEventListener('input', updateEmbedUI);

// Drag & Drop Secret File
dropZoneSecret.addEventListener('click', (e) => { if (e.target !== fileInputSecret) fileInputSecret.click(); });
dropZoneSecret.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneSecret.classList.add('dragover'); });
dropZoneSecret.addEventListener('dragleave', () => dropZoneSecret.classList.remove('dragover'));
dropZoneSecret.addEventListener('drop', (e) => {
    e.preventDefault(); dropZoneSecret.classList.remove('dragover');
    if (e.dataTransfer.files.length) { secretFile = e.dataTransfer.files[0]; updateEmbedUI(); }
});
fileInputSecret.addEventListener('change', (e) => {
    if (e.target.files.length) { secretFile = e.target.files[0]; updateEmbedUI(); }
});
removeSecretBtn.addEventListener('click', () => { secretFile = null; updateEmbedUI(); });

copyStegoKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(outputEmbedKey.value).then(() => {
        showToast("Encryption Key Copied!", "success");
        const icon = copyStegoKeyBtn.querySelector('.material-icons');
        icon.textContent = 'check';
        setTimeout(() => icon.textContent = 'content_copy', 2000);
    });
});

async function buildPayloadBuffer() {
    const encoder = new TextEncoder();
    if (isTextMode) {
        const textBytes = encoder.encode(inputStegoMessage.value.trim());
        const payload = new Uint8Array(1 + textBytes.length);
        payload[0] = 0x01; // Text
        payload.set(textBytes, 1);
        return payload.buffer;
    } else {
        const fileBuffer = await secretFile.arrayBuffer();
        const mimeBytes = encoder.encode(secretFile.type || 'application/octet-stream');
        
        let nameStr = secretFile.name || 'secret.file';
        if (nameStr.length > 60) {
            const ext = nameStr.split('.').pop();
            nameStr = nameStr.substring(0, 50) + '.' + ext;
        }
        const nameBytes = encoder.encode(nameStr);
        
        const payload = new Uint8Array(1 + 1 + mimeBytes.length + 1 + nameBytes.length + fileBuffer.byteLength);
        let offset = 0;
        payload[offset++] = 0x02; // File
        payload[offset++] = mimeBytes.length;
        payload.set(mimeBytes, offset); offset += mimeBytes.length;
        payload[offset++] = nameBytes.length;
        payload.set(nameBytes, offset); offset += nameBytes.length;
        payload.set(new Uint8Array(fileBuffer), offset);
        return payload.buffer;
    }
}

// Helper to convert any image to PNG Blob in RAM
function convertToPngBlob(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                resolve(blob);
            }, 'image/png');
        };
        img.onerror = reject;
        img.src = url;
    });
}

btnEmbed.addEventListener('click', async () => {
    try {
        btnEmbed.disabled = true;
        btnEmbed.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        
        let needsConversion = isLsbMode && embedFile.type !== 'image/png';
        if (needsConversion) {
            icon.textContent = 'transform';
            btnEmbed.appendChild(icon);
            btnEmbed.appendChild(document.createTextNode(' Converting Format...'));
        } else {
            icon.textContent = 'hourglass_empty';
            btnEmbed.appendChild(icon);
            btnEmbed.appendChild(document.createTextNode(' Encrypting...'));
        }
        
        // slight delay to let UI render the button change
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        
        const exportedKey = await crypto.subtle.exportKey("raw", key);
        const base64Key = bufferToBase64(exportedKey);
        
        const payloadBuffer = await buildPayloadBuffer();
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const ciphertextBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            payloadBuffer
        );
        
        const encoder = new TextEncoder();
        const markerBytes = encoder.encode(MARKER);
        const finalPayload = new Uint8Array(markerBytes.length + iv.length + ciphertextBuffer.byteLength);
        finalPayload.set(markerBytes, 0);
        finalPayload.set(iv, markerBytes.length);
        finalPayload.set(new Uint8Array(ciphertextBuffer), markerBytes.length + iv.length);
        
        let finalFileBlob;
        let outExt = '';
        
        if (isLsbMode) {
            // Auto convert JPEG to PNG for LSB stability
            let carrierBlob = embedFile;
            if (embedFile.type !== 'image/png') {
                carrierBlob = await convertToPngBlob(embedFile);
            }
            finalFileBlob = await encodeLSB(carrierBlob, finalPayload);
            outExt = '.png'; // LSB strictly outputs PNG
        } else {
            // Create the blob directly from the original file + payload (Zero memory duplication)
            finalFileBlob = new Blob([embedFile, finalPayload], { type: embedFile.type });
        }
        
        if (generatedFileUrl) URL.revokeObjectURL(generatedFileUrl);
        generatedFileUrl = URL.createObjectURL(finalFileBlob);
        
        outputEmbedKey.value = base64Key;
        downloadStegoBtn.href = generatedFileUrl;
        
        const nameParts = embedFile.name.split('.');
        let outName = embedFile.name + '_secure';
        if (nameParts.length > 1) {
            const ext = nameParts.pop();
            outName = nameParts.join('.') + '_secure.' + (outExt ? outExt.replace('.','') : ext);
        } else if (outExt) {
            outName += outExt;
        }
        downloadStegoBtn.download = outName;
        
        resultEmbed.classList.remove('hidden');
        showToast("Camouflage Successfully Completed", "success");
    } catch (err) {
        console.error(err);
        showToast("Error embedding data: " + err.message, "error");
    } finally {
        btnEmbed.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = 'lock';
        btnEmbed.appendChild(icon);
        btnEmbed.appendChild(document.createTextNode(' Encrypt & Camouflage'));
        updateEmbedUI();
    }
});


// --- Extract Logic ---
function updateExtractUI() {
    if (extractFile) {
        dropZoneExtract.classList.add('hidden');
        fileInfoExtract.classList.remove('hidden');
        filenameExtract.textContent = extractFile.name;
    } else {
        dropZoneExtract.classList.remove('hidden');
        fileInfoExtract.classList.add('hidden');
        fileInputExtract.value = "";
    }
    btnExtract.disabled = !(extractFile && inputStegoKey.value.trim().length > 0);
}

// Drag & Drop Extract
dropZoneExtract.addEventListener('click', (e) => { if (e.target !== fileInputExtract) fileInputExtract.click(); });
dropZoneExtract.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneExtract.classList.add('dragover'); });
dropZoneExtract.addEventListener('dragleave', () => dropZoneExtract.classList.remove('dragover'));
dropZoneExtract.addEventListener('drop', (e) => {
    e.preventDefault(); dropZoneExtract.classList.remove('dragover');
    if (e.dataTransfer.files.length) { extractFile = e.dataTransfer.files[0]; updateExtractUI(); }
});
fileInputExtract.addEventListener('change', (e) => {
    if (e.target.files.length) { extractFile = e.target.files[0]; updateExtractUI(); }
});
removeFileExtractBtn.addEventListener('click', () => { extractFile = null; resultExtract.classList.add('hidden'); updateExtractUI(); });
inputStegoKey.addEventListener('input', updateExtractUI);


btnExtract.addEventListener('click', async () => {
    try {
        btnExtract.disabled = true;
        btnExtract.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = 'hourglass_empty';
        btnExtract.appendChild(icon);
        btnExtract.appendChild(document.createTextNode(' Extracting...'));

        // Let the UI paint the "Extracting..." state
        await new Promise(resolve => setTimeout(resolve, 50));

        const encoder = new TextEncoder();
        const markerBytes = encoder.encode(MARKER);
        
        let extractedPayload = null;
        
        if (isLsbMode) {
            try {
                const lsbBytes = await decodeLSB(extractFile);
                let lsbMarkerIndex = findMarkerIndex(lsbBytes, markerBytes);
                if (lsbMarkerIndex !== -1) {
                    extractedPayload = lsbBytes.slice(lsbMarkerIndex);
                }
            } catch(e) {
                throw new Error("Failed to read Deep Stealth payload. Ensure this is the exact unmodified PNG file.");
            }
        } else {
            let markerIndex = await findMarkerInFile(extractFile, MARKER);
            if (markerIndex !== -1) {
                const payloadBlob = extractFile.slice(markerIndex);
                const payloadBuffer = await payloadBlob.arrayBuffer();
                extractedPayload = new Uint8Array(payloadBuffer);
            }
        }
        
        if (!extractedPayload) {
            throw new Error("No hidden data found in this image (Marker missing).");
        }

        const iv = extractedPayload.slice(markerBytes.length, markerBytes.length + 12);
        const ciphertext = extractedPayload.slice(markerBytes.length + 12);

        const base64Key = inputStegoKey.value.trim();
        const rawKey = base64ToBuffer(base64Key);
        
        let key;
        try {
            key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["decrypt"]);
        } catch(e) {
            throw new Error("AES has no sense of humor. One extra space, one missing character, or one accidental edit is enough to invalidate the key. Paste it exactly as generated.");
        }
        
        let decryptedBuffer;
        try {
            decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
        } catch(e) {
            throw new Error("Decryption failed. The key is incorrect or the file was corrupted.");
        }
        
        const decBytes = new Uint8Array(decryptedBuffer);
        const typeByte = decBytes[0];
        
        resultExtract.innerHTML = ''; 
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'success-header';
        headerDiv.innerHTML = `<span class="material-icons text-success" style="font-size: 2rem;">lock_open</span><h3 class="text-success">Data Extracted Successfully</h3>`;
        resultExtract.appendChild(headerDiv);
        
        if (activeExtractUrl) URL.revokeObjectURL(activeExtractUrl);
        
        if (typeByte === 0x01) {
            const decoder = new TextDecoder();
            const secretMessage = decoder.decode(decBytes.slice(1));
            
            const detailDiv = document.createElement('div');
            detailDiv.className = 'result-detail';
            detailDiv.style.fontSize = '1.1rem';
            detailDiv.style.color = '#fff';
            detailDiv.innerHTML = safeText(secretMessage).replace(/\n/g, '<br>');
            resultExtract.appendChild(detailDiv);
            
        } else if (typeByte === 0x02) {
            let offset = 1;
            const mimeLen = decBytes[offset++];
            const decoder = new TextDecoder();
            const mimeStr = decoder.decode(decBytes.slice(offset, offset + mimeLen));
            offset += mimeLen;
            const nameLen = decBytes[offset++];
            const nameStr = decoder.decode(decBytes.slice(offset, offset + nameLen));
            offset += nameLen;
            
            const fileData = decBytes.slice(offset);
            const blob = new Blob([fileData], { type: mimeStr });
            activeExtractUrl = URL.createObjectURL(blob);
            
            const previewContainer = document.createElement('div');
            previewContainer.style.marginTop = '1.5rem';
            previewContainer.style.background = 'rgba(0,0,0,0.3)';
            previewContainer.style.padding = '1rem';
            previewContainer.style.borderRadius = '8px';
            previewContainer.style.textAlign = 'center';
            
            if (mimeStr.startsWith('image/')) {
                previewContainer.innerHTML = `<img src="${activeExtractUrl}" style="max-width: 100%; max-height: 400px; border-radius: 4px; border: 1px solid var(--border-glass);">`;
            } else if (mimeStr === 'application/pdf') {
                previewContainer.innerHTML = `<iframe src="${activeExtractUrl}" style="width: 100%; height: 400px; border: none; border-radius: 4px;"></iframe>`;
            } else {
                previewContainer.innerHTML = `<span class="material-icons" style="font-size: 3rem; color: var(--cyan);">insert_drive_file</span><p style="margin-top:0.5rem; color: #fff;">${safeText(nameStr)}</p>`;
            }
            
            resultExtract.appendChild(previewContainer);
            
            const downloadBtn = document.createElement('a');
            downloadBtn.className = 'primary-btn';
            downloadBtn.style.textDecoration = 'none';
            downloadBtn.style.display = 'inline-block';
            downloadBtn.style.marginTop = '1rem';
            downloadBtn.href = activeExtractUrl;
            downloadBtn.download = safeText(nameStr);
            downloadBtn.innerHTML = `<span class="material-icons">download</span> Download Securely`;
            
            resultExtract.appendChild(downloadBtn);
        }
        
        resultExtract.classList.remove('hidden');
        showToast("Extraction Successful", "success");
        
    } catch (err) {
        console.error(err);
        resultExtract.innerHTML = '';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'error-header';
        headerDiv.innerHTML = `<span class="material-icons text-error">gpp_bad</span><h3 class="text-error">Extraction Failed</h3>`;
        
        const desc = document.createElement('p');
        desc.textContent = err.message;
        
        resultExtract.appendChild(headerDiv);
        resultExtract.appendChild(desc);
        
        resultExtract.classList.remove('hidden');
        showToast("Extraction Failed", "error");
    } finally {
        btnExtract.textContent = '';
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = 'lock_open';
        btnExtract.appendChild(icon);
        btnExtract.appendChild(document.createTextNode(' Decrypt & Extract'));
        updateExtractUI();
    }
});
