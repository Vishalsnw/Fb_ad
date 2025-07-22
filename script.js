// API keys - will be loaded dynamically
let DEEPSEEK_API_KEY = '';
let DEEPAI_API_KEY = '';

// Check if keys are loaded
function checkApiKeys() {
    if (!DEEPSEEK_API_KEY || !DEEPAI_API_KEY) {
        console.error('❌ API keys not loaded properly');
        showError('API keys not configured. Please set up your environment variables.');
        return false;
    }
    return true;
}

function handleFormSubmit(event) {
    event.preventDefault();

    const formData = getFormData();
    if (!validateForm(formData)) return;

    // Check if API keys are loaded
    if (!checkApiKeys()) return;

    console.log('🚀 Starting ad generation...');
    console.log('Form data:', formData);

    // Show loading state
    showLoading();

    // Generate text and image
    Promise.all([
        generateText(formData),
        generateImage(formData)
    ]).then(([textResult, imageResult]) => {
        console.log('✅ Generation completed successfully');
        displayResults(textResult, imageResult);
        hideLoading();
    }).catch(error => {
        console.error('❌ Generation failed:', error);
        showError(`Failed to generate ad: ${error.message}`);
        hideLoading();
    });
}

async function generateText(formData) {
    console.log('🔄 Generating text with DeepSeek...');

    if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API key not found');
    }

    const prompt = createTextPrompt(formData);
    console.log('📝 Prompt:', prompt);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
            temperature: 0.7,
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ DeepSeek API error:', errorText);
        throw new Error(`DeepSeek API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ DeepSeek response:', data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from DeepSeek API');
    }

    return data.choices[0].message.content;
}

async function generateImage(formData) {
    console.log('🖼️ Generating image with DeepAI...');

    if (!DEEPAI_API_KEY) {
        throw new Error('DeepAI API key not found');
    }

    const imagePrompt = createImagePrompt(formData);
    console.log('🎨 Image prompt:', imagePrompt);

    const formDataToSend = new FormData();
    formDataToSend.append('text', imagePrompt);

    const response = await fetch('https://api.deepai.org/api/text2img', {
        method: 'POST',
        headers: {
            'Api-Key': DEEPAI_API_KEY
        },
        body: formDataToSend
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ DeepAI API error:', errorText);
        throw new Error(`DeepAI API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ DeepAI response:', data);

    if (!data.output_url) {
        throw new Error('No image URL returned from DeepAI');
    }

    return data.output_url;
}

script.onload = function() {
        if (window.CONFIG) {
            DEEPSEEK_API_KEY = window.CONFIG.DEEPSEEK_API_KEY;
            DEEPAI_API_KEY = window.CONFIG.DEEPAI_API_KEY;

            console.log('✅ Config loaded successfully');
            console.log('DEEPSEEK_API_KEY loaded:', !!DEEPSEEK_API_KEY);
            console.log('DEEPAI_API_KEY loaded:', !!DEEPAI_API_KEY);

            if (!DEEPSEEK_API_KEY || !DEEPAI_API_KEY) {
                console.warn('⚠️ Some API keys are missing!');
                showError('API keys not configured. Please add them in Replit Secrets.');
            } else {
                console.log('🎉 All API keys ready for use!');
            }
        } else {
            console.error('❌ CONFIG object not found');
            showError('Failed to load configuration');
        }
    };