async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/wedding-registration/public/wedding-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          location_id: 2,
          customer_name: 'Test Customer',
          mobile: '9988776655',
          wedding_date: '2026-10-10',
          email: 'test@example.com'
        }
      })
    });
    const json = await res.json();
    console.log("Success:", json);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
