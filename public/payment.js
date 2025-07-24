// Payment configuration
let RAZORPAY_KEY_ID = '';
let RAZORPAY_KEY_SECRET = '';
let razorpay;

// Load Razorpay keys from config
function loadRazorpayConfig() {
    if (window.CONFIG && window.CONFIG.RAZORPAY_KEY_ID) {
        RAZORPAY_KEY_ID = window.CONFIG.RAZORPAY_KEY_ID;
        RAZORPAY_KEY_SECRET = window.CONFIG.RAZORPAY_KEY_SECRET;
        console.log('✅ Razorpay keys loaded successfully');
        console.log('RAZORPAY_KEY_ID loaded:', !!RAZORPAY_KEY_ID);
        
        // Verify Razorpay script is loaded
        if (typeof Razorpay === 'undefined') {
            console.error('❌ Razorpay script not loaded');
            loadRazorpayScript();
        } else {
            console.log('✅ Razorpay script ready');
        }
    } else {
        console.warn('⚠️ Razorpay keys not found in config - retrying...');
        // Retry after a short delay with max retries
        if (!window.razorpayRetryCount) window.razorpayRetryCount = 0;
        if (window.razorpayRetryCount < 10) {
            window.razorpayRetryCount++;
            setTimeout(loadRazorpayConfig, 500);
        } else {
            console.error('❌ Failed to load Razorpay keys after multiple retries');
        }
    }
}

// Load Razorpay script dynamically if not available
function loadRazorpayScript() {
    if (document.getElementById('razorpay-script')) return;
    
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
        console.log('✅ Razorpay script loaded dynamically');
    };
    script.onerror = () => {
        console.error('❌ Failed to load Razorpay script');
    };
    document.head.appendChild(script);
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
        adsPerMonth: 3,
        features: ['3 ads per month', 'Basic templates', 'Standard support']
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
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

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
    document.getElementById('paymentModal').style.display = 'block';
}

function checkUserSubscription() {
    // Check user's current subscription from localStorage
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    const planLimits = SUBSCRIPTION_PLANS[userPlan];

    updateUsageDisplay(userPlan, adsUsed, planLimits.adsPerMonth);

    // Add usage info to header
    const header = document.querySelector('header');
    if (header && !document.querySelector('.usage-info')) {
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
    const userPlan = localStorage.getItem('userPlan') || 'free';
    const adsUsed = parseInt(localStorage.getItem('adsUsed') || '0');
    const planLimits = SUBSCRIPTION_PLANS[userPlan];

    if (planLimits.adsPerMonth === -1) return true; // Unlimited

    if (adsUsed >= planLimits.adsPerMonth) {
        showPaymentModal();
        return false;
    }

    return true;
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

    if (!currentUser) {
        showLoginModal();
        return;
    }

    try {
        // Create Razorpay order
        const response = await fetch('/create-razorpay-order', {
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
            console.error('❌ Razorpay not loaded');
            alert('Payment system not ready. Please refresh the page and try again.');
            return;
        }

        if (!RAZORPAY_KEY_ID) {
            console.error('❌ Razorpay key not configured');
            alert('Payment configuration error. Please contact support.');
            return;
        }

        // Initialize Razorpay payment
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: price,
            currency: userCurrency,
            name: 'Facebook Ad Generator',
            description: `${plan.name} Plan Subscription`,
            order_id: orderData.order_id,
            handler: function(response) {
                console.log('✅ Payment successful:', response);
                handlePaymentSuccess(planKey, response);
            },
            prefill: {
                name: currentUser?.displayName || 'User',
                email: currentUser?.email || 'user@example.com'
            },
            theme: {
                color: '#667eea'
            },
            modal: {
                ondismiss: function() {
                    console.log('💳 Payment modal closed by user');
                }
            }
        };

        try {
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (response) {
                console.error('❌ Payment failed:', response.error);
                alert(`Payment failed: ${response.error.description}`);
            });
            rzp.open();
        } catch (error) {
            console.error('❌ Error opening Razorpay:', error);
            alert('Failed to open payment gateway. Please try again.');
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
        const response = await fetch('/verify-payment', {
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

        const data = await response.json();
        
        if (data.success) {
            // Update user subscription status
            if (currentUser) {
                currentUser.subscriptionStatus = 'premium';
                currentUser.maxUsage = Infinity;
                saveUserData(currentUser);
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