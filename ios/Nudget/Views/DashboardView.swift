import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model: DashboardViewModel
    @State private var privacyMode = false
    @State private var showOnboarding = false
    @State private var showAccounts = false
    @State private var showBills = false
    @State private var showSettings = false
    private let token: String

    init(token: String) {
        self.token = token
        _model = StateObject(wrappedValue: DashboardViewModel(token: token))
    }

    var body: some View {
        NavigationStack {
            Group {
                switch model.state {
                case .loading:
                    ProgressView("Loading your runway…")
                case .loaded(let snapshot):
                    loadedState(snapshot)
                case .needsSetup:
                    needsSetupState
                case .unauthorized:
                    ProgressView()
                case .failed(let message):
                    errorState(message)
                }
            }
            .navigationTitle("Nudget")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button {
                            showBills = true
                        } label: {
                            Label("Bills", systemImage: "calendar.badge.clock")
                        }
                        Button {
                            showAccounts = true
                        } label: {
                            Label("Accounts", systemImage: "creditcard")
                        }
                        Button {
                            showSettings = true
                        } label: {
                            Label("Settings", systemImage: "gearshape")
                        }
                        Button(role: .destructive) {
                            session.signOut()
                        } label: {
                            Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "line.3.horizontal")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Toggle(isOn: $privacyMode) {
                        Image(systemName: privacyMode ? "eye.slash" : "eye")
                    }
                    .toggleStyle(.button)
                    .accessibilityLabel("Privacy mode")
                }
            }
        }
        .task { await model.load() }
        .onChange(of: model.state) { _, newValue in
            // Expired/invalid token -> drop back to sign-in.
            if newValue == .unauthorized { session.signOut() }
        }
        .sheet(isPresented: $showOnboarding) {
            OnboardingView(token: token) {
                showOnboarding = false
                Task { await model.load() }
            }
        }
        .sheet(isPresented: $showAccounts) {
            AccountsView(token: token) {
                showAccounts = false
                Task { await model.load() }
            }
        }
        .sheet(isPresented: $showBills) {
            BillsView(token: token) {
                showBills = false
                Task { await model.load() }
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView(
                token: token,
                onClose: { showSettings = false },
                onAccountDeleted: {
                    showSettings = false
                    session.signOut()
                }
            )
        }
    }

    // MARK: - States

    private func loadedState(_ s: RunwaySnapshotView) -> some View {
        ScrollView {
            VStack(spacing: 24) {
                RiskBadge(risk: s.risk)

                VStack(spacing: 4) {
                    Text("Safe to spend")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(masked(s.safeToSpend))
                        .font(.system(size: 52, weight: .bold, design: .rounded))
                        .contentTransition(.numericText())
                    if let days = s.daysUntilPayday {
                        Text("until payday · \(Format.shortDate(s.paydayDate)) (in \(days) day\(days == 1 ? "" : "s"))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                HStack(spacing: 12) {
                    StatTile(label: "Spent today", value: masked(s.spentToday))
                    StatTile(label: "Bills before payday", value: masked(s.billsBeforePayday))
                }

                HStack(spacing: 6) {
                    if s.isStale {
                        Image(systemName: "clock.badge.exclamationmark")
                        Text("Data may be out of date")
                    } else {
                        Text(Format.relativeUpdated(s.lastUpdatedAt))
                    }
                }
                .font(.caption)
                .foregroundStyle(s.isStale ? Color.orange : Color.secondary)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await model.load() }
    }

    private var needsSetupState: some View {
        ContentUnavailableView {
            Label("Finish setting up", systemImage: "checklist")
        } description: {
            Text("Connect a bank and set your payday so Nudget can show your runway.")
        } actions: {
            Button("Set up Nudget") { showOnboarding = true }
                .buttonStyle(.borderedProminent)
            Button("Refresh") { Task { await model.load() } }
                .buttonStyle(.bordered)
        }
    }

    private func errorState(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load your runway", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            Button("Try again") { Task { await model.load() } }
                .buttonStyle(.borderedProminent)
        }
    }

    private func masked(_ value: Double?) -> String {
        privacyMode ? "•••••" : Format.currency(value)
    }
}

/// A labeled stat card used for the secondary numbers.
struct StatTile: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
