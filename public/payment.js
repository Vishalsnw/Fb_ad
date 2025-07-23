
// Payment configuration
const RAZORPAY_KEY_ID = 'rzp_test_your_key_here'; // Replace with your Razorpay key
let razorpay;

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
    
    return adsUsed < planLimits.adsPerMonth;
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
        
        // Initialize Razorpay payment
        const options = {
            key: RAZORPAY_KEY_ID,
            amount: price,
            currency: userCurrency,
            name: 'Facebook Ad Generator',
            description: `${plan.name} Plan Subscription`,
            order_id: orderData.order_id,
            handler: function(response) {
                handlePaymentSuccess(planKey, response);
            },
            prefill: {
                name: 'User',
                email: 'user@example.com'
            },
            theme: {
                color: '#667eea'
            },
            modal: {
                ondismiss: function() {
                    console.log('Payment modal closed');
                }
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed. Please try again.');
    }
}

// Payment success handler
function handlePaymentSuccess(planKey, paymentResponse) {
    // Verify payment on server side
    fetch('/verify-payment', {
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
    }).then(response => response.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem('userPlan', planKey);
            localStorage.setItem('adsUsed', '0'); // Reset usage
            alert('🎉 Payment successful! Your plan has been upgraded.');
            location.reload();
        } else {
            alert('Payment verification failed. Please contact support.');
        }
    }).catch(error => {
        console.error('Payment verification error:', error);
        alert('Payment verification failed. Please contact support.');
    });
}
