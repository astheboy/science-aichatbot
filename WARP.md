# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Science AI Chatbot** is an innovative AI-powered educational platform designed for elementary school physics education, specifically focused on GraviTrax experiments. The system enables teachers to create personalized AI tutors that guide students through physics concepts using Socratic learning methods.

**Tech Stack**: Firebase (Functions, Hosting, Firestore, Authentication), Vanilla JavaScript, Google Gemini API

**Deployment**: https://science-aichatbot.web.app

## Core Architecture

### Multi-Tier Firebase Architecture
- **Frontend**: Pure HTML/CSS/JavaScript (no framework dependencies)
  - `index.html`: Student chatbot interface with physics learning content
  - `teacher.html`: Teacher dashboard with Google OAuth authentication
  - `admin.html`: Legacy admin panel for manual teacher registration
- **Backend**: Firebase Functions (Node.js 20) with sophisticated AI integration
- **Database**: Firestore with security rules preventing direct client access to sensitive data
- **Authentication**: Firebase Auth with Google OAuth for teachers

### Key Components

#### 1. Adaptive Prompt System (`functions/index.js`)
The project's crown jewel - an intelligent system that analyzes student responses and dynamically selects appropriate tutoring strategies:

- **6 Response Types**: CONCEPT_QUESTION, EXPLORATION_DEADLOCK, FAILURE_REPORT, SUCCESS_WITHOUT_PRINCIPLE, HYPOTHESIS_INQUIRY, DEFAULT
- **Pattern Matching**: RegEx-based analysis of student messages in Korean
- **Dynamic Prompts**: Custom prompts for each response type with fallback to defaults

```javascript
// Core functions to understand:
- analyzeStudentResponse(): Student message pattern analysis
- getPromptByResponseType(): Adaptive prompt selection
- buildFullPrompt(): Complete prompt construction with context
```

#### 2. Teacher Management System
- **Unique Teacher Codes**: Auto-generated from email + user ID
- **API Key Management**: Secure server-side storage of Gemini API keys
- **Custom Prompts**: Per-teacher prompt customization capabilities
- **Model Selection**: Support for multiple Gemini models (2.0 Flash, 1.5 Flash, etc.)

#### 3. Student Learning Interface
- **Teacher Code System**: Simple access via teacher-provided codes
- **Conversation History**: Maintained for context-aware responses
- **Session Tracking**: Optional student name + session ID for analytics

## Development Commands

### Essential Firebase Commands
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project (only needed once)
firebase init

# Install Functions dependencies
cd functions && npm install && cd ..

# Local development server
firebase serve

# Run emulators for local testing
firebase emulators:start

# Functions-only emulator (for backend development)
cd functions && npm run serve

# Deploy functions only
firebase deploy --only functions

# Deploy hosting only  
firebase deploy --only hosting

# Full deployment
firebase deploy
```

### Functions Development
```bash
# In functions/ directory:
npm run build      # Build TypeScript (if applicable)
npm run serve      # Start functions emulator
npm run shell      # Interactive functions shell
npm run deploy     # Deploy functions only
npm run logs       # View function logs
```

### Local Development Workflow
1. `firebase emulators:start` - Start all emulators
2. Edit code in `public/` for frontend changes
3. Edit code in `functions/index.js` for backend changes
4. Test using local URLs provided by emulator
5. Deploy with appropriate `firebase deploy` command

## Architecture Deep Dive

### Firebase Functions Architecture
**Primary Function**: `getTutorResponse` - The AI orchestration hub
1. **Teacher Validation**: Verify teacher code and retrieve API key
2. **Response Analysis**: Classify student message type
3. **Prompt Selection**: Choose adaptive prompt based on analysis
4. **AI Generation**: Call Gemini API with optimized parameters
5. **Conversation Logging**: Store interactions for analytics (when student info provided)

**Supporting Functions**:
- `updateTeacherApiKey`: Secure API key management
- `getTeacherInfo`: Teacher profile data retrieval
- `updateTeacherPrompt`: Custom prompt management
- `updateTeacherModel`: AI model selection
- `addTeacher`: Legacy manual teacher registration

### Security Model
- **Firestore Rules**: Complete client-side lockdown of `teacher_keys` collection
- **API Key Protection**: Never exposed to client-side code
- **Authentication**: Google OAuth for teacher dashboard access
- **Server-Side Validation**: All critical operations happen in Functions

### Data Models
```javascript
// teacher_keys collection
{
  userId: string,           // Firebase Auth UID
  userEmail: string,        // Teacher email
  apiKey: string,          // Gemini API key (encrypted storage)
  teacherCode: string,     // Student-facing code
  customPrompt?: string,   // Teacher's custom prompt
  customPrompts?: object,  // Response-type specific prompts
  modelName?: string,      // Selected Gemini model
  createdAt: timestamp,
  updatedAt: timestamp
}

// conversations collection (when student info provided)
{
  teacherCode: string,
  studentName: string,
  sessionId: string,
  userMessage: string,
  aiResponse: string,
  responseType: string,
  timestamp: timestamp,
  conversationLength: number
}
```

## Key Insights for Development

### 1. Prompt Engineering Philosophy
The system implements sophisticated educational psychology principles:
- **Socratic Method**: Never gives direct answers, guides discovery
- **Context Awareness**: Maintains conversation history for coherent responses
- **Adaptive Responses**: Different strategies for different student mental states
- **Korean Language Optimization**: Regex patterns tuned for Korean student responses

### 2. Cost Optimization Strategy
- **Token Management**: Conversation history limited to last 6 turns
- **Efficient Prompts**: Structured system instructions minimize token usage
- **Model Selection**: Default to cost-effective models with option for premium
- **Batch Processing**: Conversation logging designed for efficient writes

### 3. Scalability Considerations
- **Teacher-Centric Design**: Each teacher operates independently with own resources
- **Stateless Functions**: All context passed in requests, no server state
- **Database Structure**: Optimized for read-heavy workloads
- **Firebase Limits**: Designed to stay within generous free tiers

### 4. Educational Effectiveness Features
- **GraviTrax Focus**: Specialized for physics energy transformation concepts
- **Age-Appropriate Language**: Elementary school Korean language patterns
- **Progress Tracking**: Session and response type analytics available
- **Teacher Insights**: Conversation patterns visible to teachers

## Troubleshooting Common Issues

### Functions Development
- **Cold Start Delays**: First function call may take 10-15 seconds
- **CORS Issues**: Use Firebase Functions, not direct API calls
- **Emulator Behavior**: Some Firebase features behave differently in emulators

### Authentication
- **Google OAuth**: Ensure proper Firebase Auth configuration
- **Teacher Codes**: Generated deterministically from user email + ID
- **Session Management**: Student names stored per-teacher-code in localStorage

### API Integration
- **Rate Limits**: Gemini API has generous limits but monitor usage
- **Error Handling**: Functions return structured errors for client handling
- **Response Parsing**: AI responses are plain text, no markdown formatting

## Cost Management

### Current Cost Structure (Monthly)
- **1 Class (20 students)**: ~₩100 (~$0.07 USD)
- **10 Classes (200 students)**: ~₩700 (~$0.50 USD)
- **Firebase Services**: Free tier covers expected usage

### Monitoring
- Check Firebase Console for function invocation counts
- Monitor Gemini API usage in Google AI Studio
- Conversation logging provides usage analytics

## Future Development Notes

The codebase is architected for these planned expansions:
1. **Multi-Subject Support**: JSON-based subject configuration system exists
2. **Advanced Analytics**: Session tracking infrastructure in place
3. **Attachment System**: Detailed plan exists in external documentation
4. **Mobile Optimization**: Responsive design foundation established

This project represents a sophisticated educational AI system with production-quality architecture, security, and scalability considerations built in from the ground up.
