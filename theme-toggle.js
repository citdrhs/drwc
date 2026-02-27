// Check for saved theme preference or default to dark mode
const currentTheme = localStorage.getItem('theme') || 'dark-mode';
if (currentTheme === 'light-mode') {
  document.body.classList.add('light-mode');
}

// Create and append toggle button
const themeToggle = document.createElement('button');
themeToggle.id = 'theme-toggle';
themeToggle.textContent = currentTheme === 'light-mode' ? '🌙 Dark' : '☀️ Light';
document.body.appendChild(themeToggle);

// Toggle theme on button click
themeToggle.addEventListener('click', function() {
  const isLightMode = document.body.classList.toggle('light-mode');
  const newTheme = isLightMode ? 'light-mode' : 'dark-mode';
  localStorage.setItem('theme', newTheme);
  themeToggle.textContent = isLightMode ? '🌙 Dark' : '☀️ Light';
});
