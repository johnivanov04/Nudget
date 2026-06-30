import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var message: String?
    @State private var isSignUp = false

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
            .onChange(of: isSignUp) { _, _ in message = nil }

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

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                    .textContentType(isSignUp ? .newPassword : .password)
                if isSignUp {
                    Text("Use at least 6 characters.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
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
            .disabled(isWorking || email.isEmpty || password.isEmpty)

            Spacer()
            Spacer()
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(Theme.canvas)
        .animation(.default, value: isSignUp)
    }

    private func submit() {
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
