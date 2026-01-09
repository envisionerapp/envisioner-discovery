import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
// Logo removed - using text-based logo instead

interface LoginFormData {
  email: string;
  password: string;
}

interface MfaFormData {
  mfaToken: string;
}

const LoginPage: React.FC = () => {
  const { login, verifyMfa, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState<string>('');

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm<LoginFormData>();

  const {
    register: registerMfa,
    handleSubmit: handleMfaSubmit,
    formState: { errors: mfaErrors },
    setValue: setMfaValue,
  } = useForm<MfaFormData>();

  const onLoginSubmit = async (data: LoginFormData) => {
    console.log('📄 LOGIN PAGE DEBUG: Form submitted', { email: data.email });
    setLoading(true);
    try {
      console.log('📄 LOGIN PAGE DEBUG: Calling login function...');
      const result = await login(data.email, data.password);
      console.log('📄 LOGIN PAGE DEBUG: Login result received', result);

      if (result.requiresMfa && result.userId) {
        console.log('📄 LOGIN PAGE DEBUG: MFA required, switching to MFA form');
        setMfaRequired(true);
        setMfaUserId(result.userId);
      } else {
        console.log('📄 LOGIN PAGE DEBUG: Login successful, waiting for user state update...');
      }
    } catch (error) {
      console.error('📄 LOGIN PAGE DEBUG: Login error', error);
    } finally {
      console.log('📄 LOGIN PAGE DEBUG: Setting loading to false');
      setLoading(false);
    }
  };

  const onMfaSubmit = async (data: MfaFormData) => {
    setLoading(true);
    try {
      await verifyMfa(data.mfaToken, mfaUserId);
    } catch (error) {
      console.error('MFA error:', error);
      setMfaValue('mfaToken', '');
    } finally {
      setLoading(false);
    }
  };

  // Navigate after auth state updates to ensure guards see the user
  useEffect(() => {
    console.log('📄 LOGIN PAGE DEBUG: User state changed', { user, hasUser: !!user });
    if (user) {
      console.log('📄 LOGIN PAGE DEBUG: User exists, navigating to /dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleMfaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\\D/g, '').slice(0, 6);
    setMfaValue('mfaToken', value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 card p-6">
        <div>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-black font-bold text-2xl">ED</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {mfaRequired ? 'Verify Your Identity' : 'Envisioner Discovery'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {mfaRequired
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Worldwide influencer discovery platform'
            }
          </p>
        </div>

        {!mfaRequired ? (
          <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit(onLoginSubmit)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="form-label">
                  Email address
                </label>
                <input
                  {...registerLogin('email', {
                    required: 'Email is required',
                    setValueAs: (v: string) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
                  })}
                  type="email"
                  autoComplete="email"
                  className="form-input"
                  placeholder="your.email@example.com"
                />
                {loginErrors.email && (
                  <p className="form-error">{loginErrors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...registerLogin('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="form-input pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {loginErrors.password && (
                  <p className="form-error">{loginErrors.password.message}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-black bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Secure access for Miela Digital team members only
              </p>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleMfaSubmit(onMfaSubmit)}>
            <div>
              <label htmlFor="mfaToken" className="form-label">
                Authentication Code
              </label>
              <input
                {...registerMfa('mfaToken', {
                  required: 'Authentication code is required',
                  pattern: {
                    value: /^\\d{6}$/,
                    message: 'Code must be 6 digits',
                  },
                })}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="form-input text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                onChange={handleMfaInputChange}
              />
              {mfaErrors.mfaToken && (
                <p className="form-error">{mfaErrors.mfaToken.message}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-black bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <LoadingSpinner size="sm" className="text-white" />
                ) : (
                  'Verify'
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMfaRequired(false);
                  setMfaUserId('');
                }}
                className="text-sm text-primary-700 hover:text-primary-800 font-medium"
              >
                ← Back to login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
