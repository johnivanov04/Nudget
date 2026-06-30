import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var email = ""
    @State private var password = ""
    @State private var isWorking = false
    @State private var message: String?
    @State private var isSignUp = false

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            VStack(spacing: 16) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 84, height: 84)
                    .background(
                        Theme.brand,
                        in: RoundedRectangle(cornerRadius: 22, style: .continuous)
                    )
                    .shadow(color: Theme.brand.opacity(0.35), radius: 16, x: 0, y: 8)

                VStack(spacing: 6) {
                    Text("Nudget")
                        .font(.largeTitle.weight(.bold))
                    Text("Am I safe to spend before payday?")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                    .textContentType(isSignUp ? .newPassword : .password)
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

            Button(isSignUp ? "Have an account? Sign in" : "New here? Create an account") {
                isSignUp.toggle()
                message = nil
            }
            .font(.footnote)

            Spacer()
            Spacer()
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(Theme.canvas)
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
