// js/image-upload.js - Updated with compression
let imgbbApiKey = null;
let MAX_FILE_SIZE = 100 * 1024; // 100KB in bytes
let QUALITY = 0.85; // 85% quality for compression

// Initialize ImgBB API key
async function initImgBB() {
    try {
        // Try to get from Firebase Remote Config
        if (typeof firebase !== 'undefined' && firebase.remoteConfig) {
            await firebase.remoteConfig().fetchAndActivate();
            imgbbApiKey = firebase.remoteConfig().getString('imgbb_api_key');
        }
        
        // If not available via Remote Config, try to get from a secure endpoint
        if (!imgbbApiKey) {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                imgbbApiKey = config.imgbbApiKey;
            }
        }
        
        console.log('ImgBB initialized:', imgbbApiKey ? 'Key loaded' : 'No key');
    } catch (error) {
        console.error('Failed to load ImgBB API key:', error);
    }
}

// Compress image using canvas
async function compressImage(file, maxWidth = 800, maxHeight = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions maintaining aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed data URL
                const compressedDataUrl = canvas.toDataURL('image/jpeg', QUALITY);
                
                // Convert data URL to Blob
                const byteString = atob(compressedDataUrl.split(',')[1]);
                const mimeString = compressedDataUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                
                const compressedBlob = new Blob([ab], { type: 'image/jpeg' });
                
                // Create compressed file
                const compressedFile = new File([compressedBlob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                
                console.log(`Compressed: ${(file.size / 1024).toFixed(2)}KB -> ${(compressedFile.size / 1024).toFixed(2)}KB`);
                
                resolve({
                    file: compressedFile,
                    originalSize: file.size,
                    compressedSize: compressedFile.size,
                    width: width,
                    height: height,
                    dataUrl: compressedDataUrl
                });
            };
            
            img.onerror = reject;
        };
        
        reader.onerror = reject;
    });
}

// Optimize image with multiple compression passes if needed
async function optimizeImage(file, targetSizeKB = 100) {
    let compressed = await compressImage(file);
    const targetSize = targetSizeKB * 1024;
    
    // If still too large, reduce quality in steps
    if (compressed.compressedSize > targetSize) {
        let currentQuality = QUALITY;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (compressed.compressedSize > targetSize && attempts < maxAttempts && currentQuality > 0.3) {
            currentQuality -= 0.1; // Reduce quality by 10% each attempt
            compressed = await compressImage(file, 800, 800, currentQuality);
            attempts++;
            console.log(`Compression attempt ${attempts}: ${(compressed.compressedSize / 1024).toFixed(2)}KB (Quality: ${(currentQuality * 100).toFixed(0)}%)`);
        }
    }
    
    // If still too large, reduce dimensions
    if (compressed.compressedSize > targetSize) {
        compressed = await compressImage(file, 600, 600, 0.7);
    }
    
    return compressed;
}

// Updated compressImage function with quality parameter
async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = QUALITY) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                
                // Set image smoothing for better quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw with high quality interpolation
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to WebP for better compression (if supported)
                const format = canvas.toDataURL('image/webp') ? 'image/webp' : 'image/jpeg';
                const compressedDataUrl = canvas.toDataURL(format, quality);
                
                // Convert to Blob
                const byteString = atob(compressedDataUrl.split(',')[1]);
                const mimeString = compressedDataUrl.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                
                const compressedBlob = new Blob([ab], { type: mimeString });
                const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + (format === 'image/webp' ? '.webp' : '.jpg'), {
                    type: mimeString,
                    lastModified: Date.now()
                });
                
                resolve({
                    file: compressedFile,
                    originalSize: file.size,
                    compressedSize: compressedFile.size,
                    width: width,
                    height: height,
                    dataUrl: compressedDataUrl,
                    format: format,
                    quality: quality
                });
            };
            
            img.onerror = reject;
        };
        
        reader.onerror = reject;
    });
}

// Upload image to ImgBB with compression
async function uploadToImgBB(file) {
    if (!imgbbApiKey) {
        await initImgBB();
        if (!imgbbApiKey) {
            throw new Error('Image upload service not configured. Please contact administrator.');
        }
    }

    // Show compression progress
    const uploadStatus = document.getElementById('uploadStatus');
    const progressContainer = document.querySelector('.progress-bar');
    
    if (uploadStatus && progressContainer) {
        progressContainer.classList.remove('hidden');
        uploadStatus.textContent = 'Compressing image...';
    }

    // Compress image first
    let compressed;
    try {
        compressed = await optimizeImage(file, 100); // Target 100KB
        
        if (uploadStatus) {
            uploadStatus.textContent = `Compressed: ${(compressed.originalSize / 1024).toFixed(0)}KB → ${(compressed.compressedSize / 1024).toFixed(0)}KB`;
        }
        
        // Show preview of compressed image
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            imagePreview.src = compressed.dataUrl;
        }
        
    } catch (error) {
        if (uploadStatus) {
            uploadStatus.textContent = 'Compression failed, uploading original';
        }
        compressed = { file: file, compressedSize: file.size };
    }

    // Prepare for upload
    const formData = new FormData();
    formData.append('image', compressed.file);
    
    if (uploadStatus) {
        uploadStatus.textContent = 'Uploading... 0%';
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                const progressBar = document.getElementById('uploadProgress');
                if (progressBar) {
                    progressBar.style.width = `${percentComplete}%`;
                }
                if (uploadStatus) {
                    uploadStatus.textContent = `Uploading... ${Math.round(percentComplete)}%`;
                }
            }
        };
        
        xhr.onload = () => {
            if (progressContainer) progressContainer.classList.add('hidden');
            
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        console.log('Image uploaded successfully:', {
                            size: (compressed.compressedSize / 1024).toFixed(2) + 'KB',
                            dimensions: `${compressed.width}x${compressed.height}`,
                            format: compressed.format || 'unknown'
                        });
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error?.message || 'Upload failed'));
                    }
                } catch (e) {
                    reject(new Error('Invalid response from server'));
                }
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        };
        
        xhr.onerror = () => {
            if (progressContainer) progressContainer.classList.add('hidden');
            reject(new Error('Network error occurred'));
        };
        
        xhr.open('POST', `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`);
        xhr.send(formData);
    });
}

// Setup image upload UI with size validation
function setupImageUpload() {
    const uploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('productImageInput');
    const uploadContent = document.getElementById('uploadContent');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImage');
    
    if (!uploadArea || !fileInput) return;
    
    // Click to upload
    uploadArea.addEventListener('click', (e) => {
        if (!e.target.closest('#removeImage')) {
            fileInput.click();
        }
    });
    
    // File input change
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a valid image file (JPG, PNG, WebP, GIF)');
            return;
        }
        
        // Check file size (limit to 10MB original)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image size must be less than 10MB. The image will be compressed.');
        }
        
        // Show preview of original
        const reader = new FileReader();
        reader.onload = (e) => {
            if (imagePreview) {
                imagePreview.src = e.target.result;
            }
            if (uploadContent && previewContainer) {
                uploadContent.classList.add('hidden');
                previewContainer.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
        
        try {
            // Upload and compress
            const result = await uploadToImgBB(file);
            
            // Store the image URL
            const hiddenInput = document.getElementById('productImageUrl') || 
                               (() => {
                                   const input = document.createElement('input');
                                   input.type = 'hidden';
                                   input.id = 'productImageUrl';
                                   uploadArea.appendChild(input);
                                   return input;
                               })();
            
            hiddenInput.value = result.url;
            hiddenInput.setAttribute('data-thumb', result.thumb?.url || result.url);
            hiddenInput.setAttribute('data-delete', result.delete_url || '');
            
            showNotification(`Image uploaded (${(result.size || 0) / 1024}KB)`, 'success');
            
        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Upload failed: ${error.message}`, 'error');
            resetImageUpload();
        }
    });
    
    // Remove image
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetImageUpload();
        });
    }
}

// Reset upload UI
function resetImageUpload() {
    const fileInput = document.getElementById('productImageInput');
    const uploadContent = document.getElementById('uploadContent');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const hiddenInput = document.getElementById('productImageUrl');
    
    if (fileInput) fileInput.value = '';
    if (imagePreview) imagePreview.src = '';
    if (uploadContent) uploadContent.classList.remove('hidden');
    if (previewContainer) previewContainer.classList.add('hidden');
    if (hiddenInput) {
        hiddenInput.value = '';
        hiddenInput.removeAttribute('data-thumb');
        hiddenInput.removeAttribute('data-delete');
    }
    
    const progressContainer = document.querySelector('.progress-bar');
    if (progressContainer) progressContainer.classList.add('hidden');
}

function getUploadedImage() {
    const hiddenInput = document.getElementById('productImageUrl');
    return hiddenInput ? {
        url: hiddenInput.value,
        thumb: hiddenInput.getAttribute('data-thumb') || hiddenInput.value,
        deleteUrl: hiddenInput.getAttribute('data-delete') || ''
    } : null;
}

function setImageForEdit(imageUrl) {
    const uploadContent = document.getElementById('uploadContent');
    const previewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const hiddenInput = document.getElementById('productImageUrl') || 
                       (() => {
                           const input = document.createElement('input');
                           input.type = 'hidden';
                           input.id = 'productImageUrl';
                           document.getElementById('imageUploadArea').appendChild(input);
                           return input;
                       })();
    
    if (imageUrl) {
        hiddenInput.value = imageUrl;
        hiddenInput.setAttribute('data-thumb', imageUrl);
        
        if (imagePreview) imagePreview.src = imageUrl;
        if (uploadContent) uploadContent.classList.add('hidden');
        if (previewContainer) previewContainer.classList.remove('hidden');
    } else {
        resetImageUpload();
    }
}

function showNotification(message, type) {
    const n = document.createElement('div');
    n.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white text-sm font-medium transition-all duration-300 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0';
        n.style.transform = 'translateY(-20px)';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

// Compression statistics
function getCompressionStats() {
    return {
        maxSizeKB: MAX_FILE_SIZE / 1024,
        targetQuality: QUALITY,
        maxDimensions: '800x800'
    };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupImageUpload();
    initImgBB();
});

// Export functions
window.ImageUpload = {
    uploadToImgBB,
    getUploadedImage,
    setImageForEdit,
    resetImageUpload,
    compressImage,
    optimizeImage,
    getCompressionStats
};
