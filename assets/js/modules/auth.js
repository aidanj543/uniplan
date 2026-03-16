document.getElementById("registerForm").addEventListener("submit", async function (e) { // registration
    e.preventDefault();

    const firstName = document.getElementById("firstName").value;
    const lastName = document.getElementById("lastName").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    
    if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    const userData = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password
    };

    try {

        const response = await fetch("http://localhost:5000/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            alert("Registration successful!");
            window.location.href = "login.html";
        } else {
            alert(data.message || "Registration failed");
        }

    } catch (error) {
        console.error(error);
        alert("Server error");
    }
});

const loginForm = document.getElementById("loginForm"); //login

if(loginForm){
    loginForm.addEventListener("submit", async(e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const storedUser = JSON.parse(localStorage.getItem("user"));

        if(storedUser && storedUser.email === email && storedUser.password === password){
            console.log("Login successful!");
            window.location.href = "dashboard.html";
        }
    })
}
