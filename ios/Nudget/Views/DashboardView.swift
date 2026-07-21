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
            .navigationBarTitleDisplayMode(.inline)
            .background(AmbientBackground(tint: backgroundTint))
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Wordmark()
                }
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
                onClose: {
                    showSettings = false
                    Task { await model.load() }
                },
                onAccountDeleted: {
                    showSettings = false
                    session.signOut()
                }
            )
        }
    }

    /// The ambient background tint follows the current risk once loaded.
    private var backgroundTint: Color {
        if case .loaded(let s) = model.state { return Theme.risk(s.risk) }
        return Theme.brand
    }

    // MARK: - States

    private func loadedState(_ s: RunwaySnapshotView) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                if !model.reconnectBanks.isEmpty {
                    reconnectBanner
                }

                heroCard(s)

                if let daily = s.dailySafeSpend {
                    dailyAllowanceCard(daily)
                }

                HStack(spacing: 12) {
                    StatTile(
                        icon: "cart.fill",
                        label: "Spent today",
                        value: masked(s.spentToday)
                    )
                    StatTile(
                        icon: "calendar",
                        label: "Bills before payday",
                        value: masked(s.billsBeforePayday)
                    )
                }

                if !model.upcomingBills.isEmpty {
                    upcomingBillsSection
                }

                if let insight = insight(for: s) {
                    insightCard(insight, risk: s.risk)
                }

                updatedFooter(s)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await model.load() }
    }

    // MARK: - Dashboard sections

    private var reconnectBanner: some View {
        Button {
            showAccounts = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.risk(.caution))
                VStack(alignment: .leading, spacing: 2) {
                    Text("A bank needs reconnecting")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text("Your numbers may be out of date until you reconnect.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .card(padding: 16)
        }
        .buttonStyle(.plain)
    }

    private func dailyAllowanceCard(_ daily: Double) -> some View {
        HStack(spacing: 14) {
            iconChip("wallet.pass.fill")
            VStack(alignment: .leading, spacing: 3) {
                Text("Daily allowance")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(masked(daily)) a day")
                    .font(.title3.weight(.bold))
                    .contentTransition(.numericText())
                Text("to stay safe until payday")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .card(padding: 16)
    }

    private var upcomingBillsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Upcoming bills")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Button("See all") { showBills = true }
                    .font(.subheadline)
            }
            VStack(spacing: 0) {
                ForEach(Array(model.upcomingBills.enumerated()), id: \.element.id) { index, bill in
                    if index > 0 { Divider() }
                    billRow(bill)
                }
            }
            .card(padding: 16)
        }
    }

    private func billRow(_ bill: Bill) -> some View {
        HStack(spacing: 12) {
            iconChip("calendar.badge.clock", size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(bill.displayName)
                if let date = bill.nextExpectedDate {
                    Text(Format.shortDate(date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(masked(bill.amountEstimate))
                .font(.subheadline.weight(.semibold))
        }
        .padding(.vertical, 8)
    }

    private func insightCard(_ text: String, risk: RiskLevel) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "sparkles")
                .foregroundStyle(Theme.risk(risk))
            Text(text)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .card(padding: 16)
    }

    /// A friendly, non-shaming one-liner keyed off the current state.
    private func insight(for s: RunwaySnapshotView) -> String? {
        switch s.risk {
        case .danger:
            return "You're past your safe-to-spend for now — easing up before payday will help."
        case .caution:
            return "It's a little tight. Keeping spending light keeps you covered until payday."
        case .safe:
            return s.spentToday == 0
                ? "Nothing spent yet today — you're on track."
                : "You're on track for payday. Nice work."
        case .unknown:
            return nil
        }
    }

    /// A small brand-tinted icon chip used across the dashboard cards.
    private func iconChip(_ name: String, size: CGFloat = 40) -> some View {
        Image(systemName: name)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.brand)
            .frame(width: size, height: size)
            .background(
                Theme.brand.opacity(0.12),
                in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            )
    }

    private func heroCard(_ s: RunwaySnapshotView) -> some View {
        VStack(spacing: 16) {
            RiskBadge(risk: s.risk)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 6) {
                Text("SAFE TO SPEND")
                    .font(.caption.weight(.semibold))
                    .tracking(1.6)
                    .foregroundStyle(.secondary)
                Text(masked(s.safeToSpend))
                    .font(.system(size: 58, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
                    .contentTransition(.numericText())
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                if let days = s.daysUntilPayday {
                    Text("until payday · \(Format.shortDate(s.paydayDate)) · in \(days) day\(days == 1 ? "" : "s")")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .card(padding: 28)
    }

    private func updatedFooter(_ s: RunwaySnapshotView) -> some View {
        HStack(spacing: 6) {
            Image(systemName: s.isStale ? "clock.badge.exclamationmark" : "checkmark.seal.fill")
            Text(s.isStale ? "Data may be out of date" : Format.relativeUpdated(s.lastUpdatedAt))
        }
        .font(.caption)
        .foregroundStyle(s.isStale ? Theme.risk(.caution) : Color.secondary)
        .frame(maxWidth: .infinity)
        .padding(.top, 2)
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
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.brand)
                .frame(width: 34, height: 34)
                .background(
                    Theme.brand.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(padding: 16)
    }
}
