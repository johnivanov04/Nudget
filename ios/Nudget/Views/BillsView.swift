import SwiftUI

struct BillsView: View {
    @StateObject private var vm: BillsViewModel
    private let onClose: () -> Void
    @State private var editing: Bill?
    @State private var showingAdd = false

    init(token: String, onClose: @escaping () -> Void) {
        _vm = StateObject(wrappedValue: BillsViewModel(token: token))
        self.onClose = onClose
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Bills before payday")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { showingAdd = true } label: {
                            Label("Add bill", systemImage: "plus")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { onClose() }
                    }
                }
                .sheet(item: $editing) { bill in
                    EditBillSheet(bill: bill) { amount, nextDate in
                        Task { await vm.edit(bill, amount: amount, nextDate: nextDate) }
                    }
                }
                .sheet(isPresented: $showingAdd) {
                    AddBillSheet { name, amount, nextDate, cadence in
                        Task { await vm.addBill(name: name, amount: amount, nextDate: nextDate, cadence: cadence) }
                    }
                }
        }
        .task { await vm.load() }
    }

    @ViewBuilder
    private var content: some View {
        if vm.isLoading {
            ProgressView()
        } else if vm.bills.isEmpty {
            ContentUnavailableView {
                Label("No bills yet", systemImage: "calendar.badge.clock")
            } description: {
                Text(vm.error ?? "Nudget detects recurring bills from your spending — or add one Plaid can't see, like rent.")
            } actions: {
                Button("Add a bill") { showingAdd = true }
                    .buttonStyle(.borderedProminent)
            }
        } else {
            List {
                if let error = vm.error {
                    Section { Text(error).foregroundStyle(Theme.risk(.danger)).font(.footnote) }
                }
                Section {
                    ForEach(vm.bills) { bill in
                        row(bill)
                    }
                } footer: {
                    Text("Swipe to confirm, delete, or reject. Confirmed bills count toward your runway; “likely” ones are Nudget’s best guess. Tap ＋ to add one Plaid can’t see, like rent.")
                }
            }
        }
    }

    private func row(_ bill: Bill) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(bill.displayName)
                HStack(spacing: 6) {
                    Text(Format.currency(bill.amountEstimate)).foregroundStyle(.primary)
                    if let cadence = bill.cadence { Text("· \(cadence)") }
                    if let date = bill.nextExpectedDate { Text("· \(Format.shortDate(date))") }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            if vm.busyIds.contains(bill.id) {
                ProgressView()
            } else if bill.isConfirmed {
                Label("Confirmed", systemImage: "checkmark.seal.fill")
                    .labelStyle(.iconOnly)
                    .foregroundStyle(Theme.risk(.safe))
            } else {
                Text("Likely")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Theme.risk(.caution).opacity(0.15), in: Capsule())
                    .foregroundStyle(Theme.risk(.caution))
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { editing = bill }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if bill.isConfirmed {
                // Confirmed (incl. manual) bills: hard-delete.
                Button(role: .destructive) {
                    Task { await vm.delete(bill) }
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            } else {
                // Candidates: reject so detection remembers, or confirm.
                Button(role: .destructive) {
                    Task { await vm.reject(bill) }
                } label: {
                    Label("Not a bill", systemImage: "xmark")
                }
                Button {
                    Task { await vm.confirm(bill) }
                } label: {
                    Label("Confirm", systemImage: "checkmark")
                }
                .tint(Theme.risk(.safe))
            }
        }
    }
}

/// Edit a bill's amount + next date, then confirm it.
private struct EditBillSheet: View {
    let bill: Bill
    let onSave: (Double, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var amount: Double
    @State private var date: Date

    init(bill: Bill, onSave: @escaping (Double, String) -> Void) {
        self.bill = bill
        self.onSave = onSave
        _amount = State(initialValue: bill.amountEstimate)
        _date = State(initialValue: Self.parse(bill.nextExpectedDate) ?? Date())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Amount") {
                    TextField("Amount", value: $amount, format: .currency(code: "USD"))
                        .keyboardType(.decimalPad)
                }
                Section("Next charge") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }
            }
            .navigationTitle(bill.displayName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirm") {
                        onSave(amount, Self.format(date))
                        dismiss()
                    }
                }
            }
        }
    }

    private static func parse(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        return formatter.date(from: iso)
    }
    private static func format(_ date: Date) -> String { formatter.string(from: date) }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}

/// Add a manual bill (name, amount, next date, cadence).
private struct AddBillSheet: View {
    let onSave: (String, Double, String, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Double? = nil
    @State private var date = Date()
    @State private var cadence = "monthly"

    private let cadences = ["weekly", "biweekly", "monthly", "annual"]

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name (e.g. Rent)", text: $name)
                    TextField("Amount", value: $amount, format: .currency(code: "USD"))
                        .keyboardType(.decimalPad)
                }
                Section("Next due") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }
                Section("Repeats") {
                    Picker("Repeats", selection: $cadence) {
                        ForEach(cadences, id: \.self) { Text($0.capitalized).tag($0) }
                    }
                }
            }
            .navigationTitle("Add a bill")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onSave(name.trimmingCharacters(in: .whitespaces), amount ?? 0, Self.format(date), cadence)
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
    }

    private static func format(_ date: Date) -> String { formatter.string(from: date) }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}
