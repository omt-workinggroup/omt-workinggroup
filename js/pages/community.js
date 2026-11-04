// Student community page in the resources section (also shown inside the mobile app).
import { initLayout } from '../core/layout.js';
import { bindRegisterForm } from '../core/register-form.js';

initLayout();
bindRegisterForm(document.getElementById('register-form'));
