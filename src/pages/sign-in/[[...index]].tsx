import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #fff0f3 0%, #fff 50%, #fff0f3 100%)',
      }}
    >
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        appearance={{
          elements: {
            formButtonPrimary: {
              backgroundColor: '#FF2442',
              '&:hover': { backgroundColor: '#e01f3a' },
            },
            card: {
              boxShadow: '0 20px 60px rgba(255, 36, 66, 0.1)',
              borderRadius: '16px',
            },
          },
        }}
      />
    </div>
  );
}
