// js/image-upload.js
let imgbbApiKey = null;

// Initialize ImgBB API key from Firebase Remote Config
async function initImgBB() {
    try {
        // Try to get from Firebase Remote Config
        if (typeof firebase !== 'undefined' && firebase.remoteConfig) {
            await firebase.remoteConfig().fetchAndActivate();
            imgbbApiKey = firebase.remoteConfig().getString('imgbb_api_key');
        }
        
        // If not available via Remote Config, try to get from a secure endpoint
        if (!imgbbApiKey) {
            const response = await fetch('/api/config'); // Your secure endpoint
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

// Upload image to ImgBB
async function uploadToImgBB(file) {
    if (!imgbbApiKey) {
        await initImgBB();
        if (!imgbbApiKey) {
            throw new Error('Image upload service not configured. Please contact administrator.');
        }
    }

    const formData = new FormData();
    formData.append('image', file);
    
    // Show progress
    const progressBar = document.getElementById('uploadProgress');
    const uploadStatus = document.getElementById('uploadStatus');
    const progressContainer = document.querySelector('.progress-bar');
    
    if (progressBar && uploadStatus && progressContainer) {
        progressContainer.classList.remove('hidden');
        uploadStatus.textContent = 'Uploading... 0%';
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && progressBar && uploadStatus) {
                const percentComplete = (event.loaded / event.total) * 100;
                progressBar.style.width = `${percentComplete}%`;
                uploadStatus.textContent = `Uploading... ${Math.round(percentComplete)}%`;
            }
        };
        
        xhr.onload = () => {
            if (progressContainer) progressContainer.classList.add('hidden');
            
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
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

// Setup image upload UI
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
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a valid image file (JPG, PNG, WebP)');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Image size must be less than 5MB');
            return;
        }
        
        // Show preview
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
            // Upload to ImgBB
            const result = await uploadToImgBB(file);
            
            // Store the image URL in a hidden field or data attribute
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
            
            showNotification('Image uploaded successfully!', 'success');
            
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setupImageUpload();
    initImgBB();
});

// Export functions
window.ImageUpload = {
    uploadToImgBB,
    getUploadedImage,
    setImageForEdit,
    resetImageUpload
};
