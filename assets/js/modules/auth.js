const registerForm = document.getElementById("registerForm");

if (registerForm){
    registerForm.addEventListener("submit", async(e) => {
        e.preventDefault();
        const firstName = document.getElementById("firstName").value;
        const lastName = document.getElementById("lastName").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const user = {firstName, lastName, email, password};

        localStorage.setItem("user", JSON.stringify(user));
        alert("Registration successful! Please log in.");
        window.location.href = "login.html";
    })
}
