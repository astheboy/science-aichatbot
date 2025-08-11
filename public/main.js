import { learningObjectives, inquiryQuestions } from './content.js';
import { initChatbot } from './chatbot.js';

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    populateLearningObjectives();
    populateInquiryQuestions();
    
    initChatbot();
});

function populateLearningObjectives() {
    const container = document.querySelector('#learning-objectives ul');
    if (!container) return;

    const icons = ['brain-circuit', 'flask-conical', 'users'];
    
    learningObjectives.forEach((obj, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-start';
        li.innerHTML = `
            <i data-lucide="${icons[index % icons.length]}" class="w-6 h-6 mr-4 text-blue-500 flex-shrink-0 mt-1"></i>
            <span><strong>${obj.title}:</strong> ${obj.description}</span>
        `;
        container.appendChild(li);
    });
    lucide.createIcons();
}

function populateInquiryQuestions() {
    const container = document.querySelector('#inquiry-questions ul');
    if (!container) return;

    inquiryQuestions.forEach(q => {
        const li = document.createElement('li');
        li.className = 'flex items-start';
        li.innerHTML = `
            <i data-lucide="lightbulb" class="w-6 h-6 mr-4 text-yellow-500 flex-shrink-0 mt-1"></i>
            <span>${q}</span>
        `;
        container.appendChild(li);
    });
    lucide.createIcons();
}
