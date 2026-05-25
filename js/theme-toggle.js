const currentTheme = localStorage.getItem('theme') || 'dark-mode';

const themeToggle = document.createElement('button');
themeToggle.id = 'theme-toggle';
themeToggle.textContent = currentTheme === 'light-mode' ? 'Dark Mode' : 'Light Mode';
document.body.appendChild(themeToggle);

themeToggle.addEventListener('click', function () {
  const isLightMode = document.documentElement.classList.toggle('light-mode');
  const newTheme = isLightMode ? 'light-mode' : 'dark-mode';
  localStorage.setItem('theme', newTheme);
  themeToggle.textContent = isLightMode ? 'Dark Mode' : 'Light Mode';
});
