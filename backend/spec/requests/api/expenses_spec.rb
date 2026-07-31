require 'rails_helper'

RSpec.describe "Api::Expenses", type: :request do
  let!(:food_category) { Category.create!(name: "Food") }
  let!(:transport_category) { Category.create!(name: "Transport") }

  describe "GET /api/expenses" do
    it "returns all expenses with category information" do
      Expense.create!(description: "Lunch", amount: 100.00, category: food_category, date: Date.new(2026, 7, 29))
      Expense.create!(description: "Taxi", amount: 50.00, category: transport_category, date: Date.new(2026, 7, 30))

      get "/api/expenses"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json.length).to eq(2)
      expect(json.first["category"]).to eq("Transport")
    end

    it "orders by expense date even when records are created in reverse date order" do
      newest_date = Expense.create!(description: "Today", amount: 10, category: food_category, date: Date.new(2026, 7, 31))
      older_date = Expense.create!(description: "Last week", amount: 20, category: food_category, date: Date.new(2026, 7, 24))

      get "/api/expenses"

      json = JSON.parse(response.body)
      expect(json.pluck("id")).to eq([ newest_date.id, older_date.id ])
    end

    it "places a newly created current-date expense before older expense dates" do
      older = Expense.create!(description: "Yesterday", amount: 10, category: food_category, date: Date.new(2026, 7, 30))
      current = Expense.create!(description: "Today", amount: 20, category: food_category, date: Date.new(2026, 7, 31))

      get "/api/expenses"

      expect(JSON.parse(response.body).pluck("id")).to eq([ current.id, older.id ])
    end

    it "filters a backdated record into its expense month instead of its creation month" do
      february = Expense.create!(description: "Backdated", amount: 15, category: food_category, date: Date.new(2025, 2, 14))
      Expense.create!(description: "Adjacent month", amount: 25, category: food_category, date: Date.new(2025, 3, 1))

      get "/api/expenses", params: { year: 2025, month: 2 }

      expect(JSON.parse(response.body).pluck("id")).to eq([ february.id ])
    end

    it "excludes expenses across month and year boundaries" do
      Expense.create!(description: "Previous year", amount: 10, category: food_category, date: Date.new(2025, 12, 31))
      january = Expense.create!(description: "Selected month", amount: 20, category: food_category, date: Date.new(2026, 1, 15))
      Expense.create!(description: "Next month", amount: 30, category: food_category, date: Date.new(2026, 2, 1))

      get "/api/expenses", params: { year: 2026, month: 1 }

      expect(JSON.parse(response.body).pluck("id")).to eq([ january.id ])
    end

    it "uses created time and id as deterministic tie breakers for equal dates" do
      shared_time = Time.zone.parse("2026-07-31 09:00:00")
      first = Expense.create!(description: "First", amount: 10, category: food_category, date: Date.new(2026, 7, 31))
      second = Expense.create!(description: "Second", amount: 20, category: food_category, date: Date.new(2026, 7, 31))
      first.update_column(:created_at, shared_time)
      second.update_column(:created_at, shared_time)

      get "/api/expenses"

      expect(JSON.parse(response.body).pluck("id")).to eq([ second.id, first.id ])
    end
  end

  describe "POST /api/expenses" do
    context "with valid parameters" do
      let(:valid_params) do
        {
          expense: {
            description: "Team Lunch",
            amount: 150.50,
            category_id: food_category.id,
            date: Date.today
          }
        }
      end

      it "creates a new expense" do
        expect {
          post "/api/expenses", params: valid_params, as: :json
        }.to change(Expense, :count).by(1)

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json["description"]).to eq("Team Lunch")
        expect(json["amount"]).to eq(150.5)
      end
    end

    context "with invalid parameters" do
      it "with negative amounts" do
        invalid_params = {
          expense: {
            description: "Invalid expense",
            amount: -100.00,
            category_id: food_category.id,
            date: Date.today
          }
        }

        expect {
          post "/api/expenses", params: invalid_params, as: :json
        }.to change(Expense, :count).by(1)

        expect(response).to have_http_status(:created)
      end

      it "with empty descriptions" do
        invalid_params = {
          expense: {
            description: "",
            amount: 100.00,
            category_id: food_category.id,
            date: Date.today
          }
        }

        expect {
          post "/api/expenses", params: invalid_params, as: :json
        }.to change(Expense, :count).by(1)

        expect(response).to have_http_status(:created)
      end
    end
  end
end
