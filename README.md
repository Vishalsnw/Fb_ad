
# Facebook Ad Generator 🚀

An AI-powered Facebook ad generator that creates compelling ad copy and images using DeepSeek and DeepAI APIs.

## Features ✨

- **AI-Generated Ad Copy**: Professional headlines, ad text, and CTAs
- **AI-Generated Images**: Custom visuals for your products
- **Multi-Language Support**: English and Hindi
- **Multiple Ad Formats**: Facebook Feed, Instagram Story, Google Search, WhatsApp Status
- **User Authentication**: Google OAuth integration
- **Ad History**: Save and manage generated ads
- **Payment Integration**: Razorpay for premium features

## Setup Instructions 🛠️

### 1. Configure Environment Variables

Add the following secrets in your Replit environment:

```
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPAI_API_KEY=your_deepai_api_key
GOOGLE_CLIENT_ID=your_google_client_id
RAZORPAY_KEY_ID=your_razorpay_key_id (optional)
RAZORPAY_KEY_SECRET=your_razorpay_key_secret (optional)
```

### 2. Get API Keys

- **DeepSeek API**: Visit [DeepSeek Platform](https://platform.deepseek.com/)
- **DeepAI API**: Visit [DeepAI](https://deepai.org/)
- **Google OAuth**: Visit [Google Cloud Console](https://console.cloud.google.com/)

### 3. Run the Application

```bash
python3 server.py
```

The app will be available at `http://0.0.0.0:5000`

## Project Structure 📁

```
├── public/
│   ├── index.html          # Main application page
│   ├── script.js           # Core ad generation logic
│   ├── firebase-config.js  # Authentication handling
│   ├── styles.css          # Application styling
│   └── guides.html         # User guides
├── api/
│   └── config.js           # Vercel config endpoint
├── server.py               # Python development server
└── README.md              # This file
```

## Usage 📖

1. **Fill the Form**: Enter your product details, target audience, and preferences
2. **Generate Ad**: Click "Generate Ad" to create AI-powered content
3. **Review Results**: View your generated ad with performance score
4. **Download & Share**: Download images and copy ad text
5. **Generate Variations**: Create alternative versions with different tones

## API Endpoints 🔌

- `GET /config.js` - Configuration with environment variables
- `POST /save-ad` - Save generated ad to user history
- `POST /sync-user-data` - Synchronize user data
- `GET /health` - Health check endpoint

## Security 🔐

- API keys are stored as environment variables
- Client-side code doesn't expose sensitive data
- CORS headers configured for security
- User data encrypted and stored securely

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting 🔧

### Common Issues:

1. **"API keys not loaded"**: Check your Replit Secrets configuration
2. **"Network error"**: Verify internet connection and API endpoints
3. **"Image failed to load"**: DeepAI API might be down, try regenerating
4. **"Firebase auth error"**: Check Google OAuth configuration

### Debug Mode:

Enable console logging by opening browser DevTools (F12) to see detailed error messages.

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Support 💬

For support and questions:
- Check the guides page in the app
- Review console logs for errors
- Ensure all API keys are properly configured
