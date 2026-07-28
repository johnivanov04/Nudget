import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isWorking = false
    @State private var message: String?
    @State private var isSignUp = false
    /// Raw nonce for the in-flight Sign in with Apple request.
    @State private var appleNonce = ""

    /// Sign-up only: the two password fields must match before we allow submit.
    private var passwordsMatch: Bool { password == confirmPassword }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Brand mark — constant, identifies the app.
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 38, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 80, height: 80)
                .background(
                    Theme.brand,
                    in: RoundedRectangle(cornerRadius: 22, style: .continuous)
                )
                .shadow(color: Theme.brand.opacity(0.35), radius: 16, x: 0, y: 8)

            // Mode switcher — makes the current screen unmistakable.
            Picker("Mode", selection: $isSignUp) {
                Text("Sign In").tag(false)
                Text("Create Account").tag(true)
            }
            .pickerStyle(.segmented)
            .onChange(of: isSignUp) { _, _ in
                // Clear everything so each tab starts fresh.
                message = nil
                email = ""
                password = ""
                confirmPassword = ""
            }

            // Mode-specific heading.
            VStack(spacing: 6) {
                Text(isSignUp ? "Create your account" : "Welcome back")
                    .font(.title2.weight(.bold))
                Text(isSignUp
                     ? "Start tracking what's safe to spend."
                     : "Sign in to see your runway.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            // Diagnostic: why the last session ended (helps debug auto-logouts).
            if !isSignUp, let reason = AuthDiagnostics.lastSignOutReason {
                Text("Signed out: \(reason)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                    .textContentType(isSignUp ? .newPassword : .password)
                if isSignUp {
                    SecureField("Confirm password", text: $confirmPassword)
                        .textContentType(.newPassword)

                    if !confirmPassword.isEmpty && !passwordsMatch {
                        hint("Passwords don't match.", color: Theme.risk(.danger))
                    } else {
                        hint("Use at least 6 characters.", color: .secondary)
                    }
                }
            }
            .textFieldStyle(.roundedBorder)

            if let message {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button(action: submit) {
                if isWorking {
                    ProgressView().tint(.white)
                } else {
                    Text(isSignUp ? "Create account" : "Sign in")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(
                isWorking || email.isEmpty || password.isEmpty
                    || (isSignUp && (confirmPassword.isEmpty || !passwordsMatch))
            )

            HStack {
                VStack { Divider() }
                Text("or").font(.caption).foregroundStyle(.secondary)
                VStack { Divider() }
            }
            .padding(.vertical, 2)

            SignInWithAppleButton(.signIn) { request in
                let nonce = AppleNonce.random()
                appleNonce = nonce
                request.requestedScopes = [.fullName, .email]
                request.nonce = AppleNonce.sha256(nonce)
            } onCompletion: { result in
                handleApple(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .disabled(isWorking)

            Spacer()
            Spacer()
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(AmbientBackground())
        .animation(.default, value: isSignUp)
    }

    /// A small left-aligned caption used under the password fields.
    private func hint(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func handleApple(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let error):
            // The user cancelling isn't an error worth surfacing.
            if (error as? ASAuthorizationError)?.code == .canceled { return }
            message = error.localizedDescription
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8)
            else {
                message = "Couldn't read your Apple credentials. Try again."
                return
            }
            let email = credential.email // only present on first sign-in
            isWorking = true
            message = nil
            Task {
                do {
                    try await session.signInWithApple(idToken: idToken, nonce: appleNonce, fallbackEmail: email)
                } catch {
                    message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                }
                isWorking = false
            }
        }
    }

    private func submit() {
        // Defensive: the button is already disabled on mismatch, but guard anyway.
        if isSignUp && !passwordsMatch {
            message = "Passwords don't match."
            return
        }
        isWorking = true
        message = nil
        Task {
            do {
                if isSignUp {
                    try await session.signUp(email: email, password: password)
                } else {
                    try await session.signIn(email: email, password: password)
                }
            } catch {
                message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            isWorking = false
        }
    }
}
