
// Configuration - API keys loaded from environment variables
let DEEPSEEK_API_KEY = '';
let DEEPAI_API_KEY = '';

// API endpoints
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPAI_API_URL = 'https://api.deepai.org/api/text2img';

// Global variables
let currentAdData = null;
let currentImageUrl = null;

// Event listeners
document.getElementById('adForm').addEventListener('submit', handleFormSubmit);

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = getFormData();
    if (!validateForm(formData)) return;
    
    console.log('🚀 Starting ad generation with form data:', formData);
    console.log('API Keys status - DeepSeek:', !!DEEPSEEK_API_KEY, 'DeepAI:', !!DEEPAI_API_KEY);
    
    setLoading(true);
    
    try {
        console.log('📝 Generating text content...');
        const textContent = await generateAdText(formData);
        console.log('✅ Text content generated:', textContent);
        
        console.log('🖼️ Generating image...');
        const imageUrl = await generateAdImage(formData.productDescription);
        console.log('✅ Image generated:', imageUrl);
        
        // Display results
        displayResults(textContent, imageUrl);
        
    } catch (error) {
        console.error('❌ Error generating ad:', error);
        console.error('Error details:', error.message, error.stack);
        alert(`Failed to generate ad: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

function getFormData() {
    return {
        productName: document.getElementById('productName').value.trim(),
        productDescription: document.getElementById('productDescription').value.trim(),
        targetAudience: document.getElementById('targetAudience').value.trim(),
        businessType: document.getElementById('businessType').value,
        tone: document.getElementById('tone').value,
        language: document.querySelector('input[name="language"]:checked').value
    };
}

function validateForm(data) {
    if (!data.productName || !data.productDescription || !data.targetAudience || !data.tone) {
        alert('Please fill in all required fields.');
        return false;
    }
    
    if (!DEEPSEEK_API_KEY || !DEEPAI_API_KEY) {
        alert('API keys are not loaded. Please refresh the page and try again.');
        return false;
    }
    
    return true;
}

function setLoading(isLoading) {
    const btn = document.getElementById('generateBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.loading-spinner');
    
    btn.disabled = isLoading;
    
    if (isLoading) {
        btnText.style.display = 'none';
        spinner.style.display = 'inline';
    } else {
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

async function generateAdText(formData) {
    const prompt = createTextPrompt(formData);
    console.log('🔗 Making request to DeepSeek API...');
    
    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });
        
        console.log('📡 DeepSeek API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepSeek API error response:', errorText);
            throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📋 DeepSeek API response data:', data);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from DeepSeek API');
        }
        
        const content = data.choices[0].message.content;
        return parseAdContent(content);
        
    } catch (error) {
        console.error('❌ DeepSeek API call failed:', error);
        throw new Error(`Text generation failed: ${error.message}`);
    }
}

function createTextPrompt(formData) {
    const { productName, productDescription, targetAudience, businessType, tone, language } = formData;
    
    const businessContext = businessType ? ` Business type: ${businessType}.` : '';
    
    if (language === 'Hindi') {
        return `एक प्रभावशाली Facebook विज्ञापन तैयार करो। प्रोडक्ट: ${productName}। विवरण: ${productDescription}। टारगेट ऑडियंस: ${targetAudience}।${businessContext} टोन: ${getToneInHindi(tone)}। 

इस विज्ञापन में भारतीय संस्कृति और स्थानीय भावनाओं को ध्यान में रखें। कृपया निम्नलिखित format में जवाब दें:
HEADLINE: [आकर्षक हेडलाइन]
AD_TEXT: [मुख्य विज्ञापन टेक्स्ट]
CTA: [कॉल टू एक्शन]
HASHTAGS: [5 हैशटैग]`;
    } else {
        return `Write a high-converting Facebook ad for ${productName}. Description: ${productDescription}. Target audience: ${targetAudience}.${businessContext} Tone: ${tone.toLowerCase()}.

Create compelling copy that focuses on benefits, creates urgency, and includes social proof elements. Make it suitable for Indian market.

Please respond in this exact format:
HEADLINE: [Compelling headline]
AD_TEXT: [Main ad text]
CTA: [Call to action]
HASHTAGS: [5 hashtags]`;
    }
}

function getToneInHindi(tone) {
    const toneMap = {
        'Energetic': 'जोशीला',
        'Funny': 'मजेदार',
        'Emotional': 'भावनात्मक',
        'Professional': 'व्यावसायिक'
    };
    return toneMap[tone] || tone;
}

function parseAdContent(content) {
    console.log('🔍 Parsing content:', content);
    
    const result = {
        headline: '',
        adText: '',
        cta: '',
        hashtags: ''
    };
    
    // Handle both plain and markdown formats
    const headlineMatch = content.match(/\*\*HEADLINE:\*\*\s*(.*?)(?=\n\n|\*\*AD_TEXT|\*\*CTA|\*\*HASHTAGS|$)/s) || 
                         content.match(/HEADLINE:\s*(.*?)(?=\n\n|AD_TEXT|CTA|HASHTAGS|$)/s);
    
    const adTextMatch = content.match(/\*\*AD_TEXT:\*\*\s*(.*?)(?=\n\n|\*\*CTA|\*\*HASHTAGS|$)/s) || 
                       content.match(/AD_TEXT:\s*(.*?)(?=\n\n|CTA|HASHTAGS|$)/s);
    
    const ctaMatch = content.match(/\*\*CTA:\*\*\s*(.*?)(?=\n\n|\*\*HASHTAGS|$)/s) || 
                    content.match(/CTA:\s*(.*?)(?=\n\n|HASHTAGS|$)/s);
    
    const hashtagsMatch = content.match(/\*\*HASHTAGS:\*\*\s*(.*?)$/s) || 
                         content.match(/HASHTAGS:\s*(.*?)$/s);
    
    if (headlineMatch) {
        result.headline = headlineMatch[1].trim().replace(/\*\*/g, '').replace(/🚀|✨|📢/g, '').trim();
    }
    
    if (adTextMatch) {
        result.adText = adTextMatch[1].trim()
            .replace(/\*\*/g, '')
            .replace(/✅|✔|📩|🔥|💪/g, '')
            .replace(/\n\s*\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    if (ctaMatch) {
        result.cta = ctaMatch[1].trim().replace(/\*\*/g, '').replace(/📩|🔥|💪/g, '').trim();
    }
    
    if (hashtagsMatch) {
        result.hashtags = hashtagsMatch[1].trim().replace(/\*\*/g, '').trim();
    }
    
    console.log('📋 Parsed result:', result);
    return result;
}

async function generateAdImage(description) {
    console.log('🔗 Making request to DeepAI API...');
    
    try {
        const formData = new FormData();
        formData.append('text', `Professional product advertisement for ${description}, high quality, commercial photography style, clean background`);
        
        const response = await fetch(DEEPAI_API_URL, {
            method: 'POST',
            headers: {
                'api-key': DEEPAI_API_KEY
            },
            body: formData
        });
        
        console.log('📡 DeepAI API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('DeepAI API error response:', errorText);
            throw new Error(`DeepAI API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('🖼️ DeepAI API response data:', data);
        
        if (!data.output_url) {
            throw new Error('No image URL returned from DeepAI API');
        }
        
        return data.output_url;
        
    } catch (error) {
        console.error('❌ DeepAI API call failed:', error);
        throw new Error(`Image generation failed: ${error.message}`);
    }
}

function displayResults(textContent, imageUrl) {
    currentAdData = textContent;
    currentImageUrl = imageUrl;
    
    // Update text content
    document.getElementById('adHeadline').textContent = textContent.headline;
    document.getElementById('adText').textContent = textContent.adText;
    document.getElementById('adCTA').textContent = textContent.cta;
    document.getElementById('adHashtags').textContent = textContent.hashtags;
    
    // Update image
    const imageContainer = document.getElementById('imageContainer');
    const adImage = document.getElementById('adImage');
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (imageUrl) {
        adImage.src = imageUrl;
        imageContainer.style.display = 'block';
        downloadBtn.style.display = 'inline-block';
    } else {
        imageContainer.style.display = 'none';
        downloadBtn.style.display = 'none';
    }
    
    // Show results section
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

function copyAdText() {
    if (!currentAdData) return;
    
    const textToCopy = `${currentAdData.headline}\n\n${currentAdData.adText}\n\n${currentAdData.cta}\n\n${currentAdData.hashtags}`;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Show feedback
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.style.background = '#28a745';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '#28a745';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy text. Please try again.');
    });
}

async function downloadImage() {
    if (!currentImageUrl) return;
    
    try {
        console.log('📥 Downloading image from:', currentImageUrl);
        
        // Fetch the image
        const response = await fetch(currentImageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        // Get the image blob
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'facebook-ad-image.jpg';
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('✅ Image downloaded successfully');
        
    } catch (error) {
        console.error('❌ Download failed:', error);
        alert('Failed to download image. Please try right-clicking on the image and selecting "Save image as..."');
    }
}

function regenerateAd() {
    const formData = getFormData();
    if (validateForm(formData)) {
        handleFormSubmit({ preventDefault: () => {} });
    }
}

// Load configuration when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load config from the config endpoint
    const script = document.createElement('script');
    script.src = window.location.origin + '/config.js?t=' + Date.now();
    
    script.onload = function() {
        if (window.CONFIG) {
            DEEPSEEK_API_KEY = window.CONFIG.DEEPSEEK_API_KEY;
            DEEPAI_API_KEY = window.CONFIG.DEEPAI_API_KEY;
            
            console.log('✅ API keys loaded successfully');
            console.log('DEEPSEEK_API_KEY loaded:', !!DEEPSEEK_API_KEY);
            console.log('DEEPAI_API_KEY loaded:', !!DEEPAI_API_KEY);
        } else {
            console.error('CONFIG object not found');
        }
    };
    
    script.onerror = function() {
        console.error('Failed to load config.js');
    };
    
    document.head.appendChild(script);
    // Add placeholder text based on selected language
    const languageInputs = document.querySelectorAll('input[name="language"]');
    
    languageInputs.forEach(input => {
        input.addEventListener('change', function() {
            updatePlaceholders(this.value);
        });
    });
    
    function updatePlaceholders(language) {
        const productName = document.getElementById('productName');
        const productDescription = document.getElementById('productDescription');
        const targetAudience = document.getElementById('targetAudience');
        
        if (language === 'Hindi') {
            productName.placeholder = 'उदा., एरोमैजिक कॉफी बीन्स';
            productDescription.placeholder = 'अपने उत्पाद का विस्तृत विवरण दें...';
            targetAudience.placeholder = 'उदा., युवा प्रोफेशनल्स, कॉफी प्रेमी';
        } else {
            productName.placeholder = 'e.g., Aromagic Coffee Beans';
            productDescription.placeholder = 'Describe your product in detail...';
            targetAudience.placeholder = 'e.g., Young professionals, Coffee lovers';
        }
    }
});
