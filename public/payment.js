// Payment configuration
window.RAZORPAY_KEY_ID = window.RAZORPAY_KEY_ID || '';
window.RAZORPAY_KEY_SECRET = window.RAZORPAY_KEY_SECRET || '';

// Load Razorpay keys from config
function loadRazorpayConfig() {
    if (window.CONFIG && window.CONFIG.RAZORPAY_KEY_ID && window.CONFIG.RAZORPAY_KEY_SECRET) {
        window.RAZORPAY_KEY_ID = window.CONFIG.RAZORPAY_KEY_ID;
        window.RAZORPAY_KEY_SECRET = window.CONFIG.RAZORPAY_KEY_SECRET;
        console.log('✅ Razorpay keys loaded successfully');
        console.log('RAZORPAY_KEY_ID loaded:', !!window.RAZORPAY_KEY_ID);
        
        // Verify Razorpay script is loaded
        if (typeof Razorpay === 'undefined') {
            console.error('❌ Razorpay script not loaded');
            loadRazorpayScript();
        } else {
            console.log('✅ Razorpay script ready');
        }
        return true;
    } else {
        // Wait for config to load
        if (!window.razorpayRetryCount) window.razorpayRetryCount = 0;
        if (window.razorpayRetryCount < 20) {
            window.razorpayRetryCount++;
            setTimeout(loadRazorpayConfig, 200);
        } else {
            console.error('❌ Failed to load Razorpay keys - CONFIG not available');
            console.log('Available CONFIG:', window.CONFIG);
        }
        return false;
    }
}

// Load Razorpay script dynamically if not available
function loadRazorpayScript() {
    if (document.getElementById('razorpay-script')) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = 'razorpay-script';
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
            console.log('✅ Razorpay script loaded dynamically');
            resolve();
        };
        script.onerror = () => {
            console.error('❌ Failed to load Razorpay script');
            reject(new Error('Failed to load Razorpay script'));
        };
        document.head.appendChild(script);
    });
}

// Load Razorpay payment buttons - now inline in HTML
function loadRazorpayPaymentButtons() {
    console.log('✅ Razorpay payment buttons loaded inline in form tags');
}

// Load config when available
document.addEventListener('DOMContentLoaded', function() {
    // Wait for config to be loaded
    setTimeout(loadRazorpayConfig, 100);
});

// Initialize Razorpay when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupPaymentModal();
    checkUserSubscription();
});

// Subscription plans
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        adsPerMonth: 4,
        features: ['4 ads per month', 'Basic templates', 'Standard support']
    },
    pro: {
        name: 'Pro',
        price: 59900, // ₹599 in paise
        priceUSD: 799, // $7.99 in cents
        adsPerMonth: 100,
        features: ['100 ads per month', 'Premium templates', 'Priority support', 'Advanced analytics']
    },
    unlimited: {
        name: 'Unlimited',
        price: 99900, // ₹999 in paise
        priceUSD: 1299, // $12.99 in cents
        adsPerMonth: -1,
        features: ['Unlimited ads', 'All premium features', '24/7 support', 'Custom branding', 'API access']
    }
};

// Detect user's country/currency
function getUserCurrency() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isIndian = timezone.includes('Asia/Kolkata') || timezone.includes('Asia/Calcutta');
    return isIndian ? 'INR' : 'USD';
}

function formatPrice(plan, currency = 'INR') {
    if (plan.price === 0) return 'Free';

    if (currency === 'INR') {
        return `₹${(plan.price / 100).toFixed(0)}/month`;
    } else {
        return `$${(plan.priceUSD / 100).toFixed(2)}/month`;
    }
}

function setupPaymentModal() {
    const userCurrency = getUserCurrency();

    // Create payment modal HTML
    const modalHTML = `
        <div id="paymentModal" class="payment-modal" style="display: none;">
            <div class="payment-modal-content">
                <span class="payment-close">&times;</span>
                <h2>🚀 Upgrade Your Plan</h2>
                <div class="pricing-grid">
                    ${Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => `
                        <div class="pricing-card ${key === 'pro' ? 'popular' : ''}" data-plan="${key}">
                            ${key === 'pro' ? '<div class="popular-badge">Most Popular</div>' : ''}
                            <h3>${plan.name}</h3>
                            <div class="price">
                                ${formatPrice(plan, userCurrency)}
                            </div>
                            <ul class="features">
                                ${plan.features.map(feature => `<li>✅ ${feature}</li>`).join('')}
                            </ul>
                            <button class="subscribe-btn ${key === 'free' ? 'free-plan' : ''}" 
                                    onclick="handleSubscription('${key}')" 
                                    ${key === 'free' ? 'disabled' : ''}>
                                ${key === 'free' ? 'Current Plan' : 'Subscribe Now'}
                            </button>
                            ${key !== 'free' ? `
                                <div style="margin-top: 15px; padding: 15px; border: 2px solid #667eea; border-radius: 12px; background: linear-gradient(135deg, #f8f9ff, #e6ebff);">
                                    <p style="margin: 0 0 15px 0; font-size: 1rem; color: #333; font-weight: 600; text-align: center;">⚡ Instant Payment</p>
                                    <button 
                                        class="razorpay-payment-btn" 
                                        onclick="handleSubscription('${key}')"
                                        style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%;">
                                        💳 Pay Now - ${formatPrice(plan, userCurrency)}
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Load Razorpay payment buttons
    loadRazorpayPaymentButtons();

    // Setup modal events
    const modal = document.getElementById('paymentModal');
    const closeBtn = document.querySelector('.payment-close');

    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function showPaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'block';
        console.log('💳 Payment modal opened');
    } else {
        console.error('❌ Payment modal not found');
        alert('You have reached your free plan limit of 4 ads. Please upgrade to continue generating unlimited ads!');
    }
}

// Make it globally accessible
window.showPaymentModal = showPaymentModal;

function checkUserSubscription() {
    // Only show for logged in users
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!currentUser) return;

    // Check user's current subscription from localStorage
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    const planLimits = SUBSCRIPTION_PLANS[userPlan];

    updateUsageDisplay(userPlan, adsUsed, planLimits.adsPerMonth);

    // Add usage info to header for logged in users
    const header = document.querySelector('header');
    if (header && !document.querySelector('.usage-info') && currentUser) {
        const usageHTML = `
            <div class="usage-info">
                <div class="plan-badge">${planLimits.name} Plan</div>
                <div class="usage-count">
                    ${planLimits.adsPerMonth === -1 ? 'Unlimited' : `${adsUsed}/${planLimits.adsPerMonth}`} ads used
                </div>
                ${userPlan === 'free' ? '<button onclick="showPaymentModal()" class="upgrade-btn">🚀 Upgrade</button>' : ''}
            </div>
        `;
        header.insertAdjacentHTML('beforeend', usageHTML);
    }
}

function updateUsageDisplay(plan, used, limit) {
    const usageCount = document.querySelector('.usage-count');
    if (usageCount) {
        usageCount.textContent = limit === -1 ? 'Unlimited' : `${used}/${limit} ads used`;
    }
}

function canGenerateAd() {
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!currentUser) return false; // Anonymous users handled separately
    
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    const planLimits = SUBSCRIPTION_PLANS[userPlan];

    console.log(`🔍 Checking generation limits: plan=${userPlan}, adsUsed=${adsUsed}, limit=${planLimits ? planLimits.adsPerMonth : 'unknown'}`);

    if (planLimits && planLimits.adsPerMonth === -1) {
        console.log('✅ Unlimited plan, allowing generation');
        return true; // Unlimited
    }

    // For free users, check if they've reached the limit (4 ads)
    if (adsUsed >= 4) {
        console.log('🚫 User has reached free plan limit, showing payment modal');
        showPaymentModal();
        return false;
    }
    
    console.log(`✅ Can generate: ${adsUsed}/4 ads used`);
    return true;
}

// Show payment modal for new users after they sign in
function checkAndShowUpgradePrompt() {
    const currentUser = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!currentUser) return;
    
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const hasSeenUpgradePrompt = localStorage.getItem('hasSeenUpgradePrompt');
    
    // Show upgrade prompt for new free users
    if (userPlan === 'free' && !hasSeenUpgradePrompt) {
        setTimeout(() => {
            showPaymentModal();
            localStorage.setItem('hasSeenUpgradePrompt', 'true');
        }, 2000); // Show after 2 seconds
    }
}

function incrementAdUsage() {
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    localStorage.setItem('adsUsed', (adsUsed + 1).toString());

    const userPlan = localStorage.getItem('userPlan') || 'free';
    updateUsageDisplay(userPlan, adsUsed + 1, SUBSCRIPTION_PLANS[userPlan].adsPerMonth);
}

async function handleSubscription(planKey) {
    if (planKey === 'free') return;

    const plan = SUBSCRIPTION_PLANS[planKey];
    const userCurrency = getUserCurrency();
    const price = userCurrency === 'INR' ? plan.price : plan.priceUSD;

    if (userCurrency === 'USD') {
        alert('USD payments will be available soon. Please contact support for international payments.');
        return;
    }

    const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
    if (!user) {
        showLoginModal();
        return;
    }

    try {
        // Create Razorpay order
        const response = await fetch('/api/create-razorpay-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                planKey,
                planName: plan.name,
                price: price,
                currency: userCurrency
            })
        });

        const orderData = await response.json();

        if (orderData.error) {
            alert('Error creating order: ' + orderData.error);
            return;
        }

        // Check if Razorpay is available
        if (typeof Razorpay === 'undefined') {
            console.error('❌ Razorpay not loaded, attempting to load...');
            try {
                await loadRazorpayScript();
                console.log('✅ Razorpay script loaded, retrying payment...');
                // Retry after loading
                setTimeout(() => handleSubscription(planKey), 1000);
                return;
            } catch (loadError) {
                console.error('❌ Failed to load Razorpay script:', loadError);
                alert('Payment system not ready. Please refresh the page and try again.');
                return;
            }
        }

        if (!window.RAZORPAY_KEY_ID) {
            console.error('❌ Razorpay key not configured');
            alert('Payment configuration error. Please contact support.');
            return;
        }
        
        // Log Razorpay key for debugging (first few characters only)
        console.log('🔧 Using Razorpay key:', window.RAZORPAY_KEY_ID.substring(0, 8) + '...');
        console.log('🔧 Order data received:', orderData);

        // Initialize Razorpay payment
        const options = {
            key: window.RAZORPAY_KEY_ID,
            amount: orderData.amount || price,
            currency: orderData.currency || userCurrency,
            name: 'AdGenie - Facebook Ad Generator',
            description: `${plan.name} Plan Subscription`,
            order_id: orderData.order_id,
            handler: function(response) {
                console.log('✅ Payment successful in handler:', response);
                handlePaymentSuccess(planKey, response);
            },
            prefill: {
                name: user?.displayName || 'User',
                email: user?.email || 'user@example.com'
            },
            theme: {
                color: '#667eea'
            },
            modal: {
                ondismiss: function() {
                    console.log('💳 Payment modal closed by user');
                }
            },
            retry: {
                enabled: true,
                max_count: 3
            }
        };

        try {
            console.log('🔧 Razorpay options:', {
                key: options.key,
                amount: options.amount,
                currency: options.currency,
                order_id: options.order_id,
                name: options.name
            });
            
            // Create Razorpay instance
            const rzp = new Razorpay(options);
            
            // Add success handler
            rzp.on('payment.success', function (response) {
                console.log('✅ Payment successful:', response);
                handlePaymentSuccess(planKey, response);
            });
            
            rzp.on('payment.failed', function (response) {
                console.error('❌ Payment failed:', response);
                console.error('❌ Error details:', response.error);
                console.error('❌ Full response:', JSON.stringify(response, null, 2));
                
                let errorMessage = 'Payment failed';
                if (response.error) {
                    if (response.error.description) {
                        errorMessage = response.error.description;
                    } else if (response.error.reason) {
                        errorMessage = response.error.reason;
                    } else if (response.error.code) {
                        errorMessage = `Error: ${response.error.code}`;
                        // Add specific error code handling
                        switch(response.error.code) {
                            case 'BAD_REQUEST_ERROR':
                                errorMessage = 'Invalid payment request. Please try again.';
                                break;
                            case 'GATEWAY_ERROR':
                                errorMessage = 'Payment gateway error. Please try again.';
                                break;
                            case 'NETWORK_ERROR':
                                errorMessage = 'Network error. Please check your connection.';
                                break;
                            case 'SERVER_ERROR':
                                errorMessage = 'Server error. Please try again later.';
                                break;
                        }
                    }
                }
                
                // Show more user-friendly error messages
                if (errorMessage.includes('Your card was declined')) {
                    errorMessage = 'Your card was declined. Please try a different payment method.';
                } else if (errorMessage.includes('insufficient funds')) {
                    errorMessage = 'Insufficient funds. Please check your account balance.';
                } else if (errorMessage.includes('invalid card')) {
                    errorMessage = 'Invalid card details. Please check and try again.';
                }
                
                alert(`Payment failed: ${errorMessage}\n\nIf this issue persists, please contact support.`);
            });
            
            console.log('🔧 Opening Razorpay checkout...');
            
            // Try to open with retry mechanism
            setTimeout(() => {
                try {
                    rzp.open();
                    console.log('✅ Razorpay checkout opened successfully');
                } catch (openError) {
                    console.error('❌ Failed to open Razorpay on first attempt:', openError);
                    
                    // Retry after a short delay
                    setTimeout(() => {
                        try {
                            rzp.open();
                            console.log('✅ Razorpay checkout opened on retry');
                        } catch (retryError) {
                            console.error('❌ Failed to open Razorpay on retry:', retryError);
                            alert('Unable to open payment window. Please ensure popups are allowed and try again.');
                        }
                    }, 500);
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Error creating Razorpay instance:', error);
            console.error('❌ Error type:', error.constructor.name);
            console.error('❌ Error details:', error.message);
            
            // More specific error messages
            if (error.message.includes('Razorpay is not defined')) {
                alert('Payment system not loaded. Please refresh the page and try again.');
            } else if (error.message.includes('Invalid key')) {
                alert('Payment configuration error. Please contact support.');
            } else if (error.message.includes('Amount should be') || error.message.includes('amount')) {
                alert('Invalid payment amount. Please contact support.');
            } else {
                alert('Failed to initialize payment gateway. Please check your internet connection and try again.');
            }
        }

    } catch (error) {
        console.error('Payment error:', error.message || error);
        alert('Payment failed: ' + (error.message || 'Unknown error. Please try again.'));
    }
}

// Payment success handler
async function handlePaymentSuccess(planKey, paymentResponse) {
    try {
        // Verify payment on server side
        const response = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                planKey,
                payment_id: paymentResponse.razorpay_payment_id,
                order_id: paymentResponse.razorpay_order_id,
                signature: paymentResponse.razorpay_signature
            })
        });

        let data;
        try {
            console.log('Payment verification response status:', response.status);
            console.log('Payment verification response headers:', Object.fromEntries(response.headers));
            
            // Check if response is OK first
            if (!response.ok) {
                console.error('Payment verification failed with status:', response.status);
                const errorText = await response.text();
                console.error('Error response text:', errorText.substring(0, 500));
                throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}`);
            }

            // Get response as text first to debug
            const responseText = await response.text();
            console.log('Payment verification raw response length:', responseText.length);
            console.log('Payment verification raw response:', responseText.substring(0, 1000));
            
            // Check if response starts with HTML (error page)
            if (responseText.trim().startsWith('<') || responseText.trim().startsWith('<!')) {
                console.error('Received HTML instead of JSON:', responseText.substring(0, 200));
                throw new Error('Server returned HTML error page instead of JSON. Please check server logs.');
            }
            
            // Check if response is empty
            if (!responseText.trim()) {
                throw new Error('Server returned empty response');
            }
            
            // Check if response contains "The page" which might indicate an error page
            if (responseText.includes('The page') && !responseText.trim().startsWith('{')) {
                console.error('Response appears to be an error page:', responseText.substring(0, 200));
                throw new Error('Server returned an error page instead of JSON');
            }
            
            data = JSON.parse(responseText);
            console.log('Parsed payment data:', data);
            
            // Validate response structure
            if (typeof data !== 'object' || data === null) {
                throw new Error('Invalid response structure - not an object');
            }
            
        } catch (parseError) {
            console.error('Failed to parse payment response:', parseError);
            console.error('Error type:', parseError.constructor.name);
            if (typeof responseText !== 'undefined') {
                console.error('Full response text was:', responseText);
            }
            throw new Error(`Payment verification failed: ${parseError.message}`);
        }
        
        if (data.success) {
            // Update user subscription status
            const user = typeof window.currentUser === 'function' ? window.currentUser() : null;
            if (user) {
                user.subscriptionStatus = 'premium';
                user.maxUsage = Infinity;
                if (typeof saveUserData === 'function') {
                    saveUserData(user);
                }
            }

            // Update UI and redirect
            alert('Payment successful! 🎉');
            location.reload();
        } else {
            alert('Payment verification failed. Please contact support.');
        }
    } catch (error) {
        console.error('Payment verification error:', error.message || error);
        alert('Payment verification failed: ' + (error.message || 'Please contact support.'));
    }
}